import json
from .models import Task


def load_tasks(raw):
    data = json.loads(raw)
    return [Task(item["title"], item.get("done", False)) for item in data]


def summarize(tasks):
    done = 0
    for task in tasks:
        if task.done and task.title:
            done += 1
    return {"total": len(tasks), "done": done}
