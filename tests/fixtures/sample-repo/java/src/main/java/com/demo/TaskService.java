package com.demo;

import java.util.List;
import com.demo.TaskRepository;

public class TaskService {
    private final TaskRepository repo;

    public TaskService(TaskRepository repo) {
        this.repo = repo;
    }

    public int countOpen() {
        return repo.findOpen().size();
    }
}
