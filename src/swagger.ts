export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "monkey-bot API",
    version: "1.0.0",
    description: "Playwright bot server for browser checks and security automation"
  },
  servers: [
    {
      url: "/",
      description: "Current origin"
    }
  ],
  paths: {
    "/health": {
      get: {
        summary: "Health check",
        responses: {
          200: {
            description: "Service is healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: {
                      type: "string",
                      example: "ok"
                    }
                  },
                  required: ["status"]
                }
              }
            }
          }
        }
      }
    },
    "/bots": {
      get: {
        summary: "List available bots",
        responses: {
          200: {
            description: "Bot catalog",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    bots: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: {
                            type: "string",
                            example: "smoke"
                          },
                          description: {
                            type: "string"
                          }
                        },
                        required: ["id", "description"]
                      }
                    }
                  },
                  required: ["bots"]
                }
              }
            }
          }
        }
      }
    },
    "/run": {
      post: {
        summary: "Run the default bot (smoke)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  url: {
                    type: "string",
                    format: "uri",
                    example: "https://example.com"
                  },
                  waitForSelector: {
                    type: "string",
                    example: "h1"
                  },
                  timeoutMs: {
                    type: "integer",
                    minimum: 1,
                    example: 20000
                  }
                },
                required: ["url"]
              }
            }
          }
        },
        responses: {
          200: {
            description: "Bot run completed",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: {
                      type: "boolean",
                      example: true
                    },
                    result: {
                      type: "object",
                      properties: {
                        title: {
                          type: "string",
                          example: "Example Domain"
                        },
                        finalUrl: {
                          type: "string",
                          example: "https://example.com/"
                        },
                        consoleErrors: {
                          type: "array",
                          items: {
                            type: "string"
                          }
                        },
                        failedRequests: {
                          type: "array",
                          items: {
                            type: "string"
                          }
                        }
                      },
                      required: ["title", "finalUrl", "consoleErrors", "failedRequests"]
                    }
                  },
                  required: ["ok", "result"]
                }
              }
            }
          },
          400: {
            description: "Validation error"
          },
          500: {
            description: "Bot execution error"
          }
        }
      }
    },
    "/run/{botId}": {
      post: {
        summary: "Run a bot by id",
        parameters: [
          {
            name: "botId",
            in: "path",
            required: true,
            schema: {
              type: "string"
            },
            example: "login-smoke"
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  url: {
                    type: "string",
                    format: "uri",
                    example: "https://example.com/login"
                  },
                  credentials: {
                    type: "object",
                    properties: {
                      username: {
                        type: "string",
                        example: "demo-user"
                      },
                      password: {
                        type: "string",
                        example: "demo-pass"
                      }
                    },
                    required: ["username", "password"]
                  },
                  invalidCredentials: {
                    type: "object",
                    properties: {
                      username: {
                        type: "string",
                        example: "demo-user"
                      },
                      password: {
                        type: "string",
                        example: "wrong-pass"
                      }
                    }
                  },
                  secondaryCredentials: {
                    type: "object",
                    properties: {
                      username: {
                        type: "string",
                        example: "demo-user-2"
                      },
                      password: {
                        type: "string",
                        example: "demo-pass-2"
                      }
                    }
                  },
                  selectors: {
                    type: "object",
                    properties: {
                      form: {
                        type: "string",
                        example: "form"
                      },
                      username: {
                        type: "string",
                        example: "input[name='email']"
                      },
                      password: {
                        type: "string",
                        example: "input[name='password']"
                      },
                      submit: {
                        type: "string",
                        example: "button[type='submit']"
                      },
                      success: {
                        type: "string",
                        example: "[data-test='dashboard']"
                      },
                      error: {
                        type: "string",
                        example: "[role='alert']"
                      },
                      logout: {
                        type: "string",
                        example: "button[data-test='logout']"
                      }
                    }
                  },
                  expectations: {
                    type: "object",
                    properties: {
                      postLoginUrlIncludes: {
                        type: "string",
                        example: "/app"
                      },
                      protectedUrl: {
                        type: "string",
                        example: "/app"
                      },
                      unauthorizedUrlIncludes: {
                        type: "string",
                        example: "/login"
                      },
                      sessionPersistsAfterReload: {
                        type: "boolean",
                        example: true
                      },
                      sessionPersistsAcrossTabs: {
                        type: "boolean",
                        example: true
                      },
                      sessionPersistsAfterBrowserRestart: {
                        type: "boolean",
                        example: false
                      },
                      expectedCookieNames: {
                        type: "array",
                        items: {
                          type: "string"
                        },
                        example: ["sessionid"]
                      }
                    }
                  },
                  api: {
                    type: "object",
                    properties: {
                      url: {
                        type: "string",
                        example: "/api/auth/login"
                      },
                      contentType: {
                        type: "string",
                        enum: ["json", "form"],
                        example: "json"
                      },
                      usernameField: {
                        type: "string",
                        example: "email"
                      },
                      passwordField: {
                        type: "string",
                        example: "password"
                      }
                    }
                  },
                  realtime: {
                    type: "object",
                    properties: {
                      wsUrl: {
                        type: "string",
                        example: "wss://example.com/ws"
                      },
                      expectAuthenticatedMessageIncludes: {
                        type: "string",
                        example: "authenticated"
                      }
                    }
                  },
                  timeoutMs: {
                    type: "integer",
                    minimum: 1,
                    example: 20000
                  }
                },
                required: ["url"]
              }
            }
          }
        },
        responses: {
          200: {
            description: "Bot run completed",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: {
                      type: "boolean",
                      example: true
                    },
                    result: {
                      type: "object",
                      properties: {
                        suite: {
                          type: "string",
                          example: "login-smoke"
                        },
                        ok: {
                          type: "boolean",
                          example: true
                        },
                        summary: {
                          type: "object",
                          properties: {
                            passed: {
                              type: "integer",
                              example: 4
                            },
                            failed: {
                              type: "integer",
                              example: 0
                            },
                            skipped: {
                              type: "integer",
                              example: 1
                            }
                          }
                        },
                        artifactsDir: {
                          type: "string",
                          example: ".artifacts/login/login-smoke"
                        },
                        scenarios: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              key: {
                                type: "string",
                                example: "valid-login"
                              },
                              title: {
                                type: "string",
                                example: "valid credentials grant access"
                              },
                              status: {
                                type: "string",
                                enum: ["passed", "failed", "skipped"],
                                example: "passed"
                              },
                              durationMs: {
                                type: "integer",
                                example: 1280
                              },
                              notes: {
                                type: "array",
                                items: {
                                  type: "string"
                                }
                              },
                              errors: {
                                type: "array",
                                items: {
                                  type: "string"
                                }
                              },
                              finalUrl: {
                                type: "string",
                                example: "https://example.com/app"
                              },
                              consoleErrors: {
                                type: "array",
                                items: {
                                  type: "string"
                                }
                              },
                              failedRequests: {
                                type: "array",
                                items: {
                                  type: "string"
                                }
                              }
                            },
                            required: ["key", "title", "status", "durationMs", "notes", "errors", "consoleErrors", "failedRequests"]
                          }
                        }
                      },
                      required: ["suite", "ok", "summary", "scenarios"]
                    }
                  },
                  required: ["ok", "result"]
                }
              }
            }
          },
          400: {
            description: "Validation error"
          },
          404: {
            description: "Bot not found"
          },
          500: {
            description: "Bot execution error"
          }
        }
      }
    }
  }
} as const;
