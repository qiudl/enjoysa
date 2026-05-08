package translate

import (
	_ "embed"
	"fmt"
	"sync"

	"gopkg.in/yaml.v3"
)

//go:embed terminology.yml
var terminologyYAML []byte

type GlossaryEntry struct {
	EN string `yaml:"en"`
	ZH string `yaml:"zh"`
}

type Glossary struct {
	Places   []GlossaryEntry `yaml:"places"`
	Business []GlossaryEntry `yaml:"business"`
}

var (
	loadedGlossary *Glossary
	loadOnce       sync.Once
	loadErr        error
)

// LoadGlossary parses the embedded terminology YAML once and returns the
// shared in-memory glossary. Safe to call concurrently.
func LoadGlossary() (*Glossary, error) {
	loadOnce.Do(func() {
		var g Glossary
		if err := yaml.Unmarshal(terminologyYAML, &g); err != nil {
			loadErr = fmt.Errorf("parse terminology.yml: %w", err)
			return
		}
		loadedGlossary = &g
	})
	return loadedGlossary, loadErr
}

// All returns places + business merged in a single slice, useful when feeding
// the entire glossary to an LLM prompt.
func (g *Glossary) All() []GlossaryEntry {
	out := make([]GlossaryEntry, 0, len(g.Places)+len(g.Business))
	out = append(out, g.Places...)
	out = append(out, g.Business...)
	return out
}
