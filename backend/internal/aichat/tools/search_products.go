package tools

import (
	"fmt"
	"strings"

	"enjoysa-backend/internal/aichat/model"
	productmodel "enjoysa-backend/internal/product/model"
	productstore "enjoysa-backend/internal/product/store"
)

// RegisterSearchProducts registers the search_products tool.
func RegisterSearchProducts(ps *productstore.ProductStore) model.ToolDef {
	return model.ToolDef{
		Name:        "search_products",
		Description: "搜索旅游产品。支持关键词、区域、类别、标签筛选。返回产品列表含名称、价格、评分、简介、图片。",
		Category:    "query",
		Parameters: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"keyword":     map[string]interface{}{"type": "string", "description": "搜索关键词（产品名称或描述）"},
				"region_id":   map[string]interface{}{"type": "integer", "description": "区域ID"},
				"category_id": map[string]interface{}{"type": "integer", "description": "类别ID"},
				"tags":        map[string]interface{}{"type": "array", "items": map[string]interface{}{"type": "string"}, "description": "标签筛选，如 family/adventure/food"},
				"limit":       map[string]interface{}{"type": "integer", "description": "返回数量，默认5，最大10"},
			},
		},
		Handler: func(ctx model.ToolContext, args map[string]interface{}) (interface{}, error) {
			filter := productstore.ProductFilter{
				Page:     1,
				PageSize: 5,
			}

			if kw, ok := args["keyword"].(string); ok {
				filter.Keyword = kw
			}
			if rid, ok := args["region_id"].(float64); ok {
				filter.RegionID = uint(rid)
			}
			if cid, ok := args["category_id"].(float64); ok {
				filter.CategoryID = uint(cid)
			}
			if lim, ok := args["limit"].(float64); ok {
				l := int(lim)
				if l > 10 {
					l = 10
				}
				if l < 1 {
					l = 5
				}
				filter.PageSize = l
			}

			products, total, err := ps.ListPublic(filter)
			if err != nil {
				return nil, fmt.Errorf("search failed: %w", err)
			}

			// Filter by tags if specified
			if tagsRaw, ok := args["tags"]; ok {
				if tagSlice, ok := tagsRaw.([]interface{}); ok && len(tagSlice) > 0 {
					var filtered []productmodel.Product
					for _, p := range products {
						if matchTags(p.Tags, tagSlice) {
							filtered = append(filtered, p)
						}
					}
					products = filtered
					total = int64(len(filtered))
				}
			}

			items := make([]map[string]interface{}, 0, len(products))
			for _, p := range products {
				item := formatProduct(p, ctx.Language)
				items = append(items, item)
			}

			return map[string]interface{}{
				"products": items,
				"total":    total,
			}, nil
		},
	}
}

func formatProduct(p productmodel.Product, lang string) map[string]interface{} {
	name := p.NameZh
	summary := p.SummaryZh
	if lang == "en" {
		if p.NameEn != "" {
			name = p.NameEn
		}
		if p.SummaryEn != "" {
			summary = p.SummaryEn
		}
	}

	imageURL := ""
	if len(p.Images) > 0 {
		imageURL = p.Images[0].URL
	}

	regionName := ""
	if p.Region != nil {
		regionName = p.Region.NameZh
		if lang == "en" && p.Region.NameEn != "" {
			regionName = p.Region.NameEn
		}
	}

	return map[string]interface{}{
		"id":           p.ID,
		"name":         name,
		"summary":      summary,
		"price_from":   p.PriceFrom,
		"currency":     p.Currency,
		"rating":       p.Rating,
		"review_count": p.ReviewCount,
		"duration":     p.Duration,
		"region":       regionName,
		"image_url":    imageURL,
		"url":          fmt.Sprintf("/product/%d", p.ID),
	}
}

func matchTags(productTags string, filterTags []interface{}) bool {
	ptLower := strings.ToLower(productTags)
	for _, ft := range filterTags {
		if tag, ok := ft.(string); ok {
			if strings.Contains(ptLower, strings.ToLower(tag)) {
				return true
			}
		}
	}
	return false
}
