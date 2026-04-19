import json
with open('backend/src/main/resources/roster_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
    print(list(data.keys()))
