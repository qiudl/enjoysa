package llmprovider

import "context"

const GLMCode = "glm"

// DefaultGLMModel is what GLMProvider uses if no model is supplied.
// glm-4-flash is the cheap general-purpose chat model; tool calling supported.
const DefaultGLMModel = "glm-4-flash"

// GLMProvider talks to ZhipuAI's OpenAI-compatible /chat/completions.
// (Different from the existing aichat/service.GLMClient which only does
// glm-4v-flash vision DescribeImages.)
type GLMProvider struct {
	c *openAICompatClient
}

func NewGLMProvider(baseURL, apiKey, model string) *GLMProvider {
	if model == "" {
		model = DefaultGLMModel
	}
	return &GLMProvider{c: newOpenAICompatClient(GLMCode, baseURL, apiKey, model)}
}

func (p *GLMProvider) Code() string         { return p.c.code }
func (p *GLMProvider) DefaultModel() string { return p.c.model }

func (p *GLMProvider) ChatStream(ctx context.Context, req Request, onEvent func(StreamEvent) bool) error {
	return p.c.chatStream(ctx, req, onEvent)
}

func (p *GLMProvider) ChatJSON(ctx context.Context, req Request) (string, []ToolCall, error) {
	return p.c.chatJSON(ctx, req)
}
