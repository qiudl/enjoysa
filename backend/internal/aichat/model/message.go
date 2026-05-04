package model

// Message represents a chat message for LLM context.
type Message struct {
	Role    string `json:"role"`    // system | user | assistant | tool
	Content string `json:"content"`
}
