"""Synthetic GitHub responses: no network or Apple credentials needed."""
import copy
import io
import runpy
import unittest
import urllib.error
from pathlib import Path
from unittest.mock import patch

helpers = runpy.run_path(str(Path(__file__).with_name('release-readiness.py')))


class RequiredChecks(unittest.TestCase):
    def setUp(self):
        self.sha, self.repo = 'a' * 40, 'owner/newave_flow'
        self.prefix = '/repos/' + self.repo
        self.main = {'ref': 'refs/heads/main', 'object': {'type': 'commit', 'sha': self.sha}}
        self.runs, self.jobs = {}, {}
        for identifier, (workflow, names) in enumerate(helpers['REQUIRED'].items(), 101):
            run = {'id': identifier, 'head_sha': self.sha, 'head_branch': 'main', 'event': 'push',
                   'head_repository': {'full_name': self.repo}, 'path': '.github/workflows/' + workflow,
                   'status': 'completed', 'conclusion': 'success', 'run_attempt': 2}
            self.runs[workflow] = {'workflow_runs': [run]}
            self.jobs[identifier] = {'total_count': len(names), 'jobs': [
                {'name': name, 'run_id': identifier, 'run_attempt': 2, 'head_sha': self.sha,
                 'status': 'completed', 'conclusion': 'success'} for name in names]}
        self.requests = []

    def get(self, endpoint):
        self.requests.append(endpoint)
        if endpoint == self.prefix + '/git/ref/heads/main':
            return copy.deepcopy(self.main)
        for workflow, payload in self.runs.items():
            if endpoint.startswith(self.prefix + '/actions/workflows/' + workflow + '/runs?'):
                self.assertIn('head_sha=' + self.sha, endpoint)
                return copy.deepcopy(payload)
        for identifier, payload in self.jobs.items():
            if endpoint == self.prefix + f'/actions/runs/{identifier}/attempts/2/jobs?per_page=100':
                return copy.deepcopy(payload)
        self.fail('Unexpected validation endpoint')

    def verify(self):
        return helpers['verify'](self.repo, self.sha, self.get)

    def test_exact_commit_and_every_required_job_pass(self):
        result = self.verify()
        self.assertTrue(result['readyForSigning'])
        self.assertEqual([item['attempt'] for item in result['checks']], [2, 2])
        self.assertEqual(len(self.requests), 6)

    def test_previous_commit_fork_and_same_name_other_workflow_do_not_count(self):
        original = copy.deepcopy(self.runs)
        for change in ({'head_sha': 'b' * 40}, {'head_branch': 'feature'}, {'event': 'pull_request'},
                       {'path': '.github/workflows/untrusted.yml'},
                       {'head_repository': {'full_name': 'fork/newave_flow'}}):
            self.runs = copy.deepcopy(original)
            self.runs['ios-check.yml']['workflow_runs'][0].update(change)
            with self.subTest(change=change), self.assertRaises(ValueError):
                self.verify()

    def test_old_success_does_not_override_new_failure_or_incomplete_run(self):
        original = copy.deepcopy(self.runs['ios-check.yml']['workflow_runs'][0])
        for status, conclusion in [('completed', 'failure'), ('completed', 'cancelled'),
                                   ('in_progress', None), ('queued', None)]:
            self.runs['ios-check.yml']['workflow_runs'] = [
                {**original, 'id': 999, 'status': status, 'conclusion': conclusion}, original]
            with self.subTest(status=status, conclusion=conclusion), self.assertRaises(ValueError):
                self.verify()

    def test_missing_skipped_wrong_commit_or_previous_attempt_job_is_rejected(self):
        original = copy.deepcopy(self.jobs)
        for change in ({'status': 'in_progress'}, {'conclusion': 'skipped'}, {'head_sha': 'b' * 40},
                       {'run_attempt': 1}, {'run_id': 999}, {'name': 'renamed job'}):
            self.jobs = copy.deepcopy(original)
            self.jobs[102]['jobs'][0].update(change)
            with self.subTest(change=change), self.assertRaises(ValueError):
                self.verify()

    def test_truncated_or_duplicate_job_list_is_rejected(self):
        self.jobs[101]['total_count'] += 1
        with self.assertRaises(ValueError):
            self.verify()
        self.jobs[101]['jobs'].append(copy.deepcopy(self.jobs[101]['jobs'][0]))
        with self.assertRaises(ValueError):
            self.verify()

    def test_missing_native_run_is_not_treated_as_success(self):
        self.runs['ios-check.yml']['workflow_runs'] = []
        with self.assertRaises(ValueError):
            self.verify()

    def test_main_advancing_before_or_during_check_is_rejected(self):
        self.main['object']['sha'] = 'b' * 40
        with self.assertRaises(ValueError):
            self.verify()
        self.main['object']['sha'] = self.sha
        self.requests.clear()
        original = self.get

        def advancing(endpoint):
            result = original(endpoint)
            if len(self.requests) == 6:
                result['object']['sha'] = 'b' * 40
            return result

        with self.assertRaises(ValueError):
            helpers['verify'](self.repo, self.sha, advancing)

    def test_invalid_repository_or_sha_never_requests_network(self):
        for repo, sha in [('https://untrusted.invalid/', self.sha), ('owner/repo/../../x', self.sha), ('../..', self.sha),
                         (self.repo, '$(echo unsafe)'), (self.repo, 'A' * 40)]:
            with self.subTest(repo=repo, sha=sha), self.assertRaises(ValueError):
                helpers['verify'](repo, sha, self.get)
        self.assertEqual(self.requests, [])

    def test_only_exact_review_branch_with_matching_runs_and_ref_is_accepted(self):
        branch = 'codex/ios-review-clarity'
        self.main['ref'] = 'refs/heads/' + branch
        for payload in self.runs.values():
            payload['workflow_runs'][0]['head_branch'] = branch
        def get(endpoint):
            if '/runs?' in endpoint:
                self.assertIn('branch=codex%2Fios-review-clarity', endpoint)
            return self.get(endpoint.replace('/git/ref/heads/' + branch, '/git/ref/heads/main'))
        self.assertTrue(helpers['verify'](self.repo, self.sha, get, branch)['readyForSigning'])
        self.runs['ios-check.yml']['workflow_runs'][0]['head_branch'] = 'main'
        with self.assertRaises(ValueError):
            helpers['verify'](self.repo, self.sha, get, branch)
        self.runs['ios-check.yml']['workflow_runs'][0]['head_branch'] = branch
        self.main['object']['sha'] = 'b' * 40
        with self.assertRaises(ValueError):
            helpers['verify'](self.repo, self.sha, get, branch)

    def test_unapproved_branch_never_requests_network(self):
        for branch in ('feature', 'codex/ios-review-clarity-other', 'codex/ios-*', '../main', 'main\n'):
            with self.subTest(branch=branch), self.assertRaises(ValueError):
                helpers['verify'](self.repo, self.sha, self.get, branch)
        self.assertEqual(self.requests, [])


class GitHubTransport(unittest.TestCase):
    def test_api_errors_never_include_token_or_response_body(self):
        error = urllib.error.HTTPError('https://api.github.com/', 403, 'private failure', {},
                                       io.BytesIO(b'private response body'))
        with patch('urllib.request.OpenerDirector.open', side_effect=error), self.assertRaises(ValueError) as failure:
            helpers['github_get']('/repos/owner/repo/actions/runs', 'private-token')
        for private in ('private-token', 'private response body', 'private failure'):
            self.assertNotIn(private, str(failure.exception))

    def test_redirects_are_rejected_instead_of_forwarding_credentials(self):
        with self.assertRaises(ValueError):
            helpers['NoRedirect']().redirect_request(None, None, 302, '', {}, 'https://untrusted.invalid/')


if __name__ == '__main__':
    unittest.main()
