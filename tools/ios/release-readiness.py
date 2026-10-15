"""Read-only GitHub checks before Apple credentials become available to signing tools."""
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request


REQUIRED = {
    'check.yml': {'frontend', 'backend', 'android',
                  'postgres-migration (PostgreSQL 17)', 'postgres-migration (PostgreSQL 18)'},
    'ios-check.yml': {'ios'},
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def latest_success(payload, repository, sha, workflow):
    require(isinstance(payload, dict) and isinstance(payload.get('workflow_runs'), list),
            'GitHub returned an invalid workflow response')
    # Limit to the actual workflow file and trusted main runs, not a similarly named PR check.
    runs = [run for run in payload['workflow_runs']
            if run.get('head_sha') == sha and run.get('head_branch') == 'main'
            and run.get('event') in ('push', 'workflow_dispatch')
            and run.get('path') == f'.github/workflows/{workflow}'
            and (run.get('head_repository') or {}).get('full_name', '').lower() == repository.lower()]
    require(bool(runs), f'Run {workflow} on this exact main commit before signing')
    require(all(type(run.get('id')) is int and type(run.get('run_attempt')) is int
                and run['id'] > 0 and run['run_attempt'] > 0 for run in runs),
            'Invalid workflow run identifier')
    newest = max(runs, key=lambda run: run['id'])
    require(newest.get('status') == 'completed' and newest.get('conclusion') == 'success',
            f'The latest {workflow} run must finish successfully; an older success is insufficient')
    return newest


def validate_jobs(payload, workflow, run):
    require(isinstance(payload, dict) and isinstance(payload.get('jobs'), list),
            'GitHub returned an invalid jobs response')
    jobs = payload['jobs']
    require(payload.get('total_count') == len(jobs), 'Incomplete job list; cannot confirm all checks')
    for name in REQUIRED[workflow]:
        matching = [job for job in jobs if job.get('name') == name]
        require(len(matching) == 1, f'Missing or ambiguous required job: {name}. Re-run all jobs, not only failed jobs.')
        job = matching[0]
        require(job.get('run_id') == run['id'] and job.get('run_attempt') == run['run_attempt']
                and job.get('head_sha') == run['head_sha']
                and job.get('status') == 'completed' and job.get('conclusion') == 'success',
                f'Required job did not pass on this commit and attempt: {name}. Re-run all jobs, not only failed jobs.')


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # Do not forward the Actions token to redirects or follow repository moves implicitly.
        raise ValueError('GitHub API redirect rejected; check repository identity')


def github_get(endpoint, token):
    require(endpoint.startswith('/repos/') and not any(c in endpoint for c in ('\r', '\n')),
            'Unexpected GitHub endpoint')
    headers = {'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
               'User-Agent': 'newave-ios-release-readiness'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    request = urllib.request.Request('https://api.github.com' + endpoint, headers=headers)
    try:
        with urllib.request.build_opener(NoRedirect()).open(request, timeout=30) as response:
            raw = response.read(2_000_001)
        require(len(raw) <= 2_000_000, 'GitHub response exceeded the validation limit')
        return json.loads(raw)
    except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError):
        raise ValueError('Cannot confirm GitHub checks; signing is blocked. No token or API body was logged.') from None


def verify(repository, sha, get):
    require(re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]*/[A-Za-z0-9][A-Za-z0-9_.-]*', repository or '') is not None,
            'Invalid GitHub repository')
    require(re.fullmatch(r'[a-f0-9]{40}', sha or '') is not None, 'Invalid release commit')
    prefix = f'/repos/{repository}'
    main = get(prefix + '/git/ref/heads/main')
    require(main.get('ref') == 'refs/heads/main' and (main.get('object') or {}).get('type') == 'commit'
            and main['object'].get('sha') == sha, 'Main changed; select and verify the current commit again')
    evidence = []
    for workflow in REQUIRED:
        query = urllib.parse.urlencode({'head_sha': sha, 'branch': 'main', 'per_page': 100})
        payload = get(prefix + f'/actions/workflows/{workflow}/runs?' + query)
        run = latest_success(payload, repository, sha, workflow)
        jobs = get(prefix + f'/actions/runs/{run["id"]}/attempts/{run["run_attempt"]}/jobs?per_page=100')
        validate_jobs(jobs, workflow, run)
        evidence.append({'workflow': workflow, 'run': run['id'], 'attempt': run['run_attempt']})
    # A push while querying must not turn the receipt into approval of an obsolete main commit.
    require((get(prefix + '/git/ref/heads/main').get('object') or {}).get('sha') == sha,
            'Main changed during verification; check the current commit again')
    return {'commit': sha, 'checks': evidence, 'readyForSigning': True}


if __name__ == '__main__':
    try:
        require(os.environ.get('GITHUB_REF') == 'refs/heads/main', 'Release checks require main')
        sha = os.environ.get('RELEASE_SHA', '')
        require(sha == os.environ.get('GITHUB_SHA'), 'Release commit differs from this workflow')
        result = verify(os.environ.get('GITHUB_REPOSITORY', ''), sha,
                        lambda endpoint: github_get(endpoint, os.environ.get('GH_TOKEN', '')))
        print(json.dumps(result))
    except (ValueError, TypeError, KeyError, AttributeError) as error:
        # Validation messages contain no credentials, response bodies, or private account data.
        raise SystemExit(str(error) if isinstance(error, ValueError) else 'Invalid GitHub check response; signing is blocked') from None
