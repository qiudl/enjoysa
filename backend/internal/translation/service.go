package translation

import (
	"context"
	"encoding/json"

	"enjoysa-backend/internal/ai/translate"

	"gorm.io/gorm"
)

// ProductFieldUpdater is implemented by a product store; we use a narrow
// interface here so the translation package does not import the product
// package directly (avoiding a cycle).
type ProductFieldUpdater interface {
	UpdateTranslatedFields(productID uint, fields map[string]string) error
}

// Service is the high-level façade other packages call.
type Service struct {
	store      *Store
	translator *translate.Translator
	products   ProductFieldUpdater
}

func NewService(store *Store, tr *translate.Translator, products ProductFieldUpdater) *Service {
	return &Service{store: store, translator: tr, products: products}
}

func (s *Service) Store() *Store {
	return s.store
}

// EnqueueProductTranslationInTx writes a pending task that the worker will
// later pick up. Caller passes their own transaction so the task is created
// in the same commit as the product status change.
func (s *Service) EnqueueProductTranslationInTx(tx *gorm.DB, productID uint, enqueuedBy uint, fields map[string]string) (*TranslationTask, error) {
	input, err := json.Marshal(fields)
	if err != nil {
		return nil, err
	}
	task := &TranslationTask{
		TargetType:  TargetTypeProduct,
		TargetID:    productID,
		Direction:   DirectionEN2ZH,
		Status:      StatusPending,
		MaxRetries:  2,
		FieldsInput: input,
		EnqueuedBy:  enqueuedBy,
	}
	if err := s.store.CreateInTx(tx, task); err != nil {
		return nil, err
	}
	return task, nil
}

// ProcessOne pulls one pending task, runs the LLM, and writes back results.
// Returns false if no work was available. Used by the worker loop.
func (s *Service) ProcessOne(ctx context.Context) (bool, error) {
	task, err := s.store.ClaimNextPending()
	if err != nil {
		return false, err
	}
	if task == nil {
		return false, nil
	}

	var fields map[string]string
	if err := json.Unmarshal(task.FieldsInput, &fields); err != nil {
		_ = s.store.MarkFailedOrRetry(task.ID, "decode fields_input: "+err.Error())
		return true, err
	}

	dir := translate.EN2ZH
	if task.Direction == DirectionZH2EN {
		dir = translate.ZH2EN
	}
	resp, err := s.translator.Translate(ctx, translate.Request{Direction: dir, Fields: fields})
	if err != nil {
		_ = s.store.MarkFailedOrRetry(task.ID, err.Error())
		return true, err
	}

	output, _ := json.Marshal(resp.Translations)

	// Write the translated values back to the product before flipping the
	// task to success, so consumers polling status see the preview as soon as
	// the task reaches success.
	if task.TargetType == TargetTypeProduct && s.products != nil {
		if err := s.products.UpdateTranslatedFields(task.TargetID, resp.Translations); err != nil {
			_ = s.store.MarkFailedOrRetry(task.ID, "persist translation: "+err.Error())
			return true, err
		}
	}

	if err := s.store.MarkSuccess(task.ID, output, resp.PromptTokens, resp.CompletionTokens, resp.CostUSD, resp.Provider, resp.ModelVersion); err != nil {
		return true, err
	}
	return true, nil
}

// RetryFailed exposed at service level for handler use.
func (s *Service) RetryFailed(taskID uint) error {
	return s.store.RetryFailed(taskID)
}
