export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "monkey-bot API",
    version: "1.0.0",
    description: "Playwright bot server for browser checks and security automation"
  },
  servers: [
    {
      url: "http://localhost:3000",
      description: "Local development server"
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
    "/run": {
      post: {
        summary: "Run a Playwright bot check",
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
    }
  }
} as const;