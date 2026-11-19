package com.example.traffic.domain;

import java.util.List;

public record PageResult<T>(List<T> items, int page, int size, long total, int totalPages) {

    public static <T> PageResult<T> of(List<T> all, int page, int size) {
        int safeSize = Math.max(1, Math.min(size, 50));
        int totalPages = Math.max(1, (int) Math.ceil(all.size() / (double) safeSize));
        int safePage = Math.max(1, Math.min(page, totalPages));
        int from = Math.min((safePage - 1) * safeSize, all.size());
        int to = Math.min(from + safeSize, all.size());
        return new PageResult<>(all.subList(from, to), safePage, safeSize, all.size(), totalPages);
    }
}
