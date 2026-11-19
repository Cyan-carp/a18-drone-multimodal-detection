package com.example.traffic.web;

import org.springframework.http.HttpStatus;

/**
 * 受控业务异常：状态码 + 稳定错误码 + 人读消息 + 可追溯明细。
 */
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;
    private final String detail;

    public ApiException(HttpStatus status, String code, String message, String detail) {
        super(message);
        this.status = status;
        this.code = code;
        this.detail = detail;
    }

    public HttpStatus status() {
        return status;
    }

    public String code() {
        return code;
    }

    public String detail() {
        return detail;
    }
}
