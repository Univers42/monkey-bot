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
            example: "smoke"
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
                    example: "https://example.com"
                  },
                  waitForSelector: {
                    type: "string",
                    example: "h1"
                  },
                  username: {
                    type: "string",
                    example: "demo-user"
                  },
                  password: {
                    type: "string",
                    example: "demo-pass"
                  },
                  usernameSelector: {
                    type: "string",
                    example: "input[name='email']"
                  },
                  passwordSelector: {
                    type: "string",
                    example: "input[name='password']"
                  },
                  submitSelector: {
                    type: "string",
                    example: "button[type='submit']"
                  },
                  successSelector: {
                    type: "string",
                    example: "[data-test='dashboard']"
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