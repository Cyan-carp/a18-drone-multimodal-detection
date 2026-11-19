package com.example.traffic.domain;

public enum RunStatus {
    QUEUED,
    RUNNING,
    SUCCESS,
    FAILED;

    public boolean isTerminal() {
        return this == SUCCESS || this == FAILED;
    }
}
