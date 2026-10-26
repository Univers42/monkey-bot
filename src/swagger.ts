export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "monkey-bot API",
    version: "1.0.0",
    description:
      "Authorized security-testing bots for Univers42 apps (smoke checks, form XSS probes with Google mutants calibration)"
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
                            example: "form-xss"
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
    "/targets": {
      get: {
        summary: "List configured target URLs",
        description: "Reads config/targets.json merged with config/targets.local.json",
        responses: {
          200: {
            description: "Configured targets",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    targets: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string", example: "local-app" },
                          url: { type: "string", format: "uri" },
                          description: { type: "string" }
                        },
                        required: ["id", "url"]
                      }
                    }
                  },
                  required: ["targets"]
                }
              }
            }
          },
          500: {
            description: "Targets config missing or invalid"
          }
        }
      }
    },
    "/mutants/{file}": {
      get: {
        summary: "Serve a mutant HTML fixture",
        parameters: [
          {
            name: "file",
            in: "path",
            required: true,
            schema: { type: "string", example: "reflected-xss.html" }
          }
        ],
        responses: {
          200: { description: "HTML fixture" },
          404: { description: "Unknown fixture" }
        }
      }
    },
    "/run/suite": {
      post: {
        summary: "Calibrate and run security bots for a target",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  targetId: { type: "string", example: "mutant-lab-reflected-xss" },
                  url: { type: "string", format: "uri" },
                  botIds: {
                    type: "array",
                    items: { type: "string" },
                    example: ["form-xss"]
                  },
                  calibrateOnly: { type: "boolean" },
                  writeArtifact: { type: "boolean" },
                  timeoutMs: { type: "integer", minimum: 1 }
                }
              }
            }
          }
        },
        responses: {
          200: { description: "Suite completed" },
          400: { description: "Validation error" },
          500: { description: "Suite execution error" }
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
                  targetId: {
                    type: "string",
                    example: "local-app",
                    description: "Named target from config/targets.json"
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
                }
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
            example: "form-xss"
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                oneOf: [
                  {
                    type: "object",
                    description: "smoke bot",
                    properties: {
                      url: { type: "string", format: "uri" },
                      targetId: { type: "string", example: "local-app" },
                      waitForSelector: { type: "string" },
                      timeoutMs: { type: "integer", minimum: 1 }
                    }
                  },
                  {
                    type: "object",
                    description: "form-xss bot",
                    properties: {
                      url: {
                        type: "string",
                        format: "uri",
                        description: "Target page; omit when using targetId or calibrateOnly"
                      },
                      targetId: {
                        type: "string",
                        example: "local-app",
                        description: "Named target from config/targets.json"
                      },
                      formSelector: { type: "string", example: "form" },
                      fieldSelector: {
                        type: "string",
                        example: "input[name=q]"
                      },
                      submitSelector: { type: "string", example: "button[type=submit]" },
                      timeoutMs: { type: "integer", minimum: 1, example: 20000 },
                      calibrateOnly: {
                        type: "boolean",
                        example: true,
                        description: "Run mutant calibration only"
                      }
                    }
                  }
                ]
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
                    ok: { type: "boolean", example: true },
                    result: { type: "object" }
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