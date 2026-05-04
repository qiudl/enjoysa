package tools

import (
	"fmt"

	"enjoysa-backend/internal/aichat/model"
	productstore "enjoysa-backend/internal/product/store"
)

// RegisterProductDetail registers the get_product_detail tool.
func RegisterProductDetail(ps *productstore.ProductStore) model.ToolDef {
	return model.ToolDef{
		Name:        "get_product_detail",
		Description: "获取产品完整详情，包含描述、亮点、套餐价格、常见问题。用于回答用户关于某个具体产品的提问。",
		Category:    "query",
		Parameters: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"product_id": map[string]interface{}{"type": "integer", "description": "产品ID（必填）"},
			},
			"required": []string{"product_id"},
		},
		Handler: func(ctx model.ToolContext, args map[string]interface{}) (interface{}, error) {
			pidFloat, ok := args["product_id"].(float64)
			if !ok {
				return nil, fmt.Errorf("product_id is required")
			}
			pid := uint(pidFloat)

			p, err := ps.GetByID(pid)
			if err != nil {
				return nil, fmt.Errorf("product not found: %w", err)
			}

			lang := ctx.Language

			name := p.NameZh
			desc := p.DescriptionZh
			if lang == "en" {
				if p.NameEn != "" {
					name = p.NameEn
				}
				if p.DescriptionEn != "" {
					desc = p.DescriptionEn
				}
			}

			// Truncate description
			if len([]rune(desc)) > 500 {
				desc = string([]rune(desc)[:500]) + "..."
			}

			// Highlights
			highlights := make([]string, 0)
			for _, h := range p.Highlights {
				text := h.TitleZh
				if lang == "en" && h.TitleEn != "" {
					text = h.TitleEn
				}
				highlights = append(highlights, text)
			}

			// Packages
			packages := make([]map[string]interface{}, 0)
			for _, pkg := range p.Packages {
				pkgName := pkg.NameZh
				if lang == "en" && pkg.NameEn != "" {
					pkgName = pkg.NameEn
				}
				packages = append(packages, map[string]interface{}{
					"name":  pkgName,
					"price": pkg.Price,
				})
			}

			// FAQs (max 5)
			faqs := make([]map[string]string, 0)
			for i, faq := range p.FAQs {
				if i >= 5 {
					break
				}
				q := faq.QuestionZh
				a := faq.AnswerZh
				if lang == "en" {
					if faq.QuestionEn != "" {
						q = faq.QuestionEn
					}
					if faq.AnswerEn != "" {
						a = faq.AnswerEn
					}
				}
				faqs = append(faqs, map[string]string{"question": q, "answer": a})
			}

			regionName := ""
			if p.Region != nil {
				regionName = p.Region.NameZh
				if lang == "en" && p.Region.NameEn != "" {
					regionName = p.Region.NameEn
				}
			}

			imageURL := ""
			if len(p.Images) > 0 {
				imageURL = p.Images[0].URL
			}

			return map[string]interface{}{
				"id":          p.ID,
				"name":        name,
				"description": desc,
				"highlights":  highlights,
				"packages":    packages,
				"faqs":        faqs,
				"duration":    p.Duration,
				"group_size":  p.GroupSize,
				"region":      regionName,
				"rating":      p.Rating,
				"review_count": p.ReviewCount,
				"image_url":   imageURL,
				"url":         fmt.Sprintf("/product/%d", p.ID),
			}, nil
		},
	}
}
