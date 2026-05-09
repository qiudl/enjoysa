package llmprovider

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// helper: spin up a fake OpenAI-compatible server that streams the given
// canned SSE lines (each already prefixed with "data: " or not — handled here).
func newFakeStreamServer(t *testing.T, sseLines []string, expectAuth string) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer "+expectAuth {
			http.Error(w, "bad auth", http.StatusUnauthorized)
			return
		}
		if !strings.HasSuffix(r.URL.Path, "/chat/completions") {
			http.Error(w, "bad path", http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		flusher, _ := w.(http.Flusher)
		for _, line := range sseLines {
			if !strings.HasPrefix(line, "data:") {
				line = "data: " + line
			}
			fmt.Fprintln(w, line)
			fmt.Fprintln(w) // blank separator
			if flusher != nil {
				flusher.Flush()
			}
		}
	}))
}

func TestDeepSeekProvider_ChatStream_TextChunks(t *testing.T) {
	srv := newFakeStreamServer(t, []string{
		`{"choices":[{"delta":{"content":"Hello"}}]}`,
		`{"choices":[{"delta":{"content":" world"}}]}`,
		`{"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"total_tokens":42}}`,
		`[DONE]`,
	}, "ds-test-key")
	defer srv.Close()

	p := NewDeepSeekProvider(srv.URL, "ds-test-key", "deepseek-chat")
	if p.Code() != "deepseek" {
		t.Fatalf("Code() = %q, want deepseek", p.Code())
	}
	if p.DefaultModel() != "deepseek-chat" {
		t.Fatalf("DefaultModel() = %q", p.DefaultModel())
	}

	var collected []StreamEvent
	err := p.ChatStream(context.Background(), Request{
		Messages: []Message{{Role: "user", Content: "hi"}},
	}, func(ev StreamEvent) bool {
		collected = append(collected, ev)
		return true
	})
	if err != nil {
		t.Fatalf("ChatStream err: %v", err)
	}

	wantContents := []string{"Hello", " world"}
	var gotContents []string
	var gotDone *StreamEvent
	for i := range collected {
		ev := collected[i]
		switch ev.Type {
		case "content":
			gotContents = append(gotContents, ev.Content)
		case "done":
			gotDone = &ev
		}
	}
	if len(gotContents) != len(wantContents) {
		t.Fatalf("content events = %d, want %d (%v)", len(gotContents), len(wantContents), collected)
	}
	for i, want := range wantContents {
		if gotContents[i] != want {
			t.Fatalf("content[%d] = %q, want %q", i, gotContents[i], want)
		}
	}
	if gotDone == nil {
		t.Fatalf("no done event in %v", collected)
	}
	if gotDone.TotalTokens != 42 {
		t.Fatalf("done.TotalTokens = %d, want 42", gotDone.TotalTokens)
	}
}

func TestGLMProvider_ChatStream_ToolCalls(t *testing.T) {
	// GLM emits tool calls split across multiple SSE chunks (typical OpenAI behavior).
	srv := newFakeStreamServer(t, []string{
		`{"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_abc","type":"function","function":{"name":"search_products"}}]}}]}`,
		`{"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\"q\":\""}}]}}]}`,
		`{"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"red wine\"}"}}]}}]}`,
		`{"choices":[{"delta":{},"finish_reason":"tool_calls"}]}`,
		`[DONE]`,
	}, "glm-test-key")
	defer srv.Close()

	p := NewGLMProvider(srv.URL, "glm-test-key", "")
	if p.Code() != "glm" {
		t.Fatalf("Code() = %q", p.Code())
	}
	if p.DefaultModel() != DefaultGLMModel {
		t.Fatalf("DefaultModel() = %q, want %q", p.DefaultModel(), DefaultGLMModel)
	}

	var sawToolCalls []ToolCall
	var sawDone bool
	err := p.ChatStream(context.Background(), Request{
		Messages: []Message{{Role: "user", Content: "find red wine"}},
		Tools: []Tool{{Type: "function", Function: ToolFunction{Name: "search_products"}}},
	}, func(ev StreamEvent) bool {
		switch ev.Type {
		case "tool_calls":
			sawToolCalls = ev.ToolCalls
		case "done":
			sawDone = true
		}
		return true
	})
	if err != nil {
		t.Fatalf("ChatStream err: %v", err)
	}
	if !sawDone {
		t.Fatalf("no done event")
	}
	if len(sawToolCalls) != 1 {
		t.Fatalf("tool_calls = %d, want 1", len(sawToolCalls))
	}
	tc := sawToolCalls[0]
	if tc.ID != "call_abc" {
		t.Fatalf("ToolCall.ID = %q", tc.ID)
	}
	if tc.Function.Name != "search_products" {
		t.Fatalf("ToolCall.Function.Name = %q", tc.Function.Name)
	}
	wantArgs := `{"q":"red wine"}`
	if tc.Function.Arguments != wantArgs {
		t.Fatalf("ToolCall.Function.Arguments = %q, want %q", tc.Function.Arguments, wantArgs)
	}
}

func TestProvider_ChatStream_HTTPError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, `{"error":{"message":"Invalid API key"}}`, http.StatusUnauthorized)
	}))
	defer srv.Close()

	p := NewDeepSeekProvider(srv.URL, "wrong-key", "deepseek-chat")
	err := p.ChatStream(context.Background(), Request{
		Messages: []Message{{Role: "user", Content: "hi"}},
	}, func(ev StreamEvent) bool { return true })

	if err == nil {
		t.Fatal("want error")
	}
	if !strings.Contains(err.Error(), "401") {
		t.Fatalf("err missing status code: %v", err)
	}
	if !strings.Contains(err.Error(), "deepseek") {
		t.Fatalf("err missing provider code: %v", err)
	}
}

func TestProvider_ChatStream_CtxCancel(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		flusher, _ := w.(http.Flusher)
		for i := 0; i < 100; i++ {
			fmt.Fprintf(w, "data: {\"choices\":[{\"delta\":{\"content\":\"chunk%d\"}}]}\n\n", i)
			if flusher != nil {
				flusher.Flush()
			}
			time.Sleep(20 * time.Millisecond)
		}
	}))
	defer srv.Close()

	p := NewDeepSeekProvider(srv.URL, "any", "deepseek-chat")
	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		time.Sleep(50 * time.Millisecond)
		cancel()
	}()

	err := p.ChatStream(ctx, Request{Messages: []Message{{Role: "user", Content: "hi"}}}, func(ev StreamEvent) bool { return true })
	if err == nil {
		t.Fatal("want error from cancelled ctx")
	}
	if err != context.Canceled {
		// some plumbing may wrap it; accept "context canceled" substring too
		if !strings.Contains(err.Error(), "context canceled") {
			t.Fatalf("err = %v, want context.Canceled", err)
		}
	}
}

func TestProvider_ChatJSON(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		var req map[string]any
		_ = json.Unmarshal(body, &req)
		if req["stream"] != false {
			t.Errorf("expected stream=false, got %v", req["stream"])
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{{
				"message": map[string]any{
					"content": "hi back",
					"tool_calls": []map[string]any{{
						"id":   "call_1",
						"type": "function",
						"function": map[string]any{
							"name":      "do_thing",
							"arguments": `{}`,
						},
					}},
				},
			}},
		})
	}))
	defer srv.Close()

	p := NewDeepSeekProvider(srv.URL, "any", "deepseek-chat")
	content, tcs, err := p.ChatJSON(context.Background(), Request{
		Messages: []Message{{Role: "user", Content: "hi"}},
	})
	if err != nil {
		t.Fatalf("ChatJSON err: %v", err)
	}
	if content != "hi back" {
		t.Fatalf("content = %q", content)
	}
	if len(tcs) != 1 || tcs[0].Function.Name != "do_thing" {
		t.Fatalf("tool_calls = %+v", tcs)
	}
}

func TestProvider_StopEarly_OnFalseFromCallback(t *testing.T) {
	hits := 0
	srv := newFakeStreamServer(t, []string{
		`{"choices":[{"delta":{"content":"a"}}]}`,
		`{"choices":[{"delta":{"content":"b"}}]}`,
		`{"choices":[{"delta":{"content":"c"}}]}`,
		`[DONE]`,
	}, "k")
	defer srv.Close()

	p := NewDeepSeekProvider(srv.URL, "k", "m")
	err := p.ChatStream(context.Background(), Request{
		Messages: []Message{{Role: "user", Content: "go"}},
	}, func(ev StreamEvent) bool {
		hits++
		return hits < 2 // stop after the 1st event (return false on 2nd)
	})
	if err != nil {
		t.Fatalf("err: %v", err)
	}
	if hits != 2 {
		t.Fatalf("hits = %d, want 2", hits)
	}
}
