package llmprovider

import "context"

const DeepSeekCode = "deepseek"

// DeepSeekProvider talks to DeepSeek's OpenAI-compatible /chat/completions.
type DeepSeekProvider struct {
	c *openAICompatClient
}

func NewDeepSeekProvider(baseURL, apiKey, model string) *DeepSeekProvider {
	return &DeepSeekProvider{c: newOpenAICompatClient(DeepSeekCode, baseURL, apiKey, model)}
}

func (p *DeepSeekProvider) Code() string         { return p.c.code }
func (p *DeepSeekProvider) DefaultModel() string { return p.c.model }

func (p *DeepSeekProvider) ChatStream(ctx context.Context, req Request, onEvent func(StreamEvent) bool) error {
	return p.c.chatStream(ctx, req, onEvent)
}

func (p *DeepSeekProvider) ChatJSON(ctx context.Context, req Request) (string, []ToolCall, error) {
	return p.c.chatJSON(ctx, req)
}

func (p *DeepSeekProvider) ChatJSONMessage(ctx context.Context, req Request) (Message, error) {
	return p.c.chatJSONMessage(ctx, req)
}
