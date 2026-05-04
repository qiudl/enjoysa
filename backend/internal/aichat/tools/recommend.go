package tools

import (
	"fmt"
	"strings"

	"enjoysa-backend/internal/aichat/model"
	productstore "enjoysa-backend/internal/product/store"
)

// RegisterRecommendAttractions registers the recommend_attractions tool.
func RegisterRecommendAttractions(ps *productstore.ProductStore, rs *productstore.RegionStore) model.ToolDef {
	return model.ToolDef{
		Name:        "recommend_attractions",
		Description: "按区域推荐热门景点和产品。可用区域：adelaide（阿德莱德）、barossa（巴罗萨谷）、kangaroo-island（袋鼠岛）、flinders-ranges（弗林德斯山脉）、murray-river（墨累河）、limestone-coast（石灰岩海岸）。不传则推荐全部热门。也支持中文名模糊匹配。",
		Category:    "query",
		Parameters: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"region_slug": map[string]interface{}{"type": "string", "description": "区域标识，可选值见工具描述。也支持中文名模糊匹配。"},
				"limit":       map[string]interface{}{"type": "integer", "description": "返回数量，默认6，最大10"},
			},
		},
		Handler: func(ctx model.ToolContext, args map[string]interface{}) (interface{}, error) {
			limit := 6
			if lim, ok := args["limit"].(float64); ok {
				limit = int(lim)
				if limit > 10 {
					limit = 10
				}
			}

			filter := productstore.ProductFilter{
				Page:     1,
				PageSize: limit,
			}

			var regionInfo map[string]interface{}

			if slugRaw, ok := args["region_slug"].(string); ok && slugRaw != "" {
				region := resolveRegion(slugRaw, rs)
				if region != nil {
					filter.RegionID = region.ID
					name := region.NameZh
					if ctx.Language == "en" && region.NameEn != "" {
						name = region.NameEn
					}
					regionInfo = map[string]interface{}{
						"id":   region.ID,
						"name": name,
						"slug": region.Slug,
					}
				}
			}

			products, total, err := ps.ListPublic(filter)
			if err != nil {
				return nil, fmt.Errorf("recommend failed: %w", err)
			}

			items := make([]map[string]interface{}, 0, len(products))
			for _, p := range products {
				items = append(items, formatProduct(p, ctx.Language))
			}

			result := map[string]interface{}{
				"products": items,
				"total":    total,
			}
			if regionInfo != nil {
				result["region"] = regionInfo
			}

			return result, nil
		},
	}
}

func resolveRegion(input string, rs *productstore.RegionStore) *struct {
	ID     uint
	NameZh string
	NameEn string
	Slug   string
} {
	// 1. Try exact slug match
	region, err := rs.GetBySlug(input)
	if err == nil && region != nil {
		return &struct {
			ID     uint
			NameZh string
			NameEn string
			Slug   string
		}{region.ID, region.NameZh, region.NameEn, region.Slug}
	}

	// 2. Fuzzy match against all regions
	regions, err := rs.List()
	if err != nil {
		return nil
	}

	inputLower := strings.ToLower(input)
	for _, r := range regions {
		if strings.Contains(strings.ToLower(r.Slug), inputLower) ||
			strings.Contains(strings.ToLower(r.NameZh), inputLower) ||
			strings.Contains(strings.ToLower(r.NameEn), inputLower) {
			return &struct {
				ID     uint
				NameZh string
				NameEn string
				Slug   string
			}{r.ID, r.NameZh, r.NameEn, r.Slug}
		}
	}

	// 3. No match — return nil (will recommend all)
	return nil
}
