package com.example.traffic.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

@Configuration
public class EngineConfig {

    /**
     * 检测执行线程池。模拟推理是 CPU 空闲等待 + 少量计算，2 个线程足以支撑演示，
     * 同时避免批量任务把 CPU 占满。
     */
    @Bean(destroyMethod = "shutdown")
    public ExecutorService detectionExecutor() {
        AtomicInteger seq = new AtomicInteger(1);
        return Executors.newFixedThreadPool(2, runnable -> {
            Thread thread = new Thread(runnable, "detect-" + seq.getAndIncrement());
            thread.setDaemon(true);
            return thread;
        });
    }
}
