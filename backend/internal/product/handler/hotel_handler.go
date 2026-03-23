package handler

import (
	"strconv"
	"strings"

	"enjoysa-backend/internal/product/store"
	"enjoysa-backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type HotelHandler struct {
	hotelStore *store.HotelStore
}

func NewHotelHandler(hotelStore *store.HotelStore) *HotelHandler {
	return &HotelHandler{hotelStore: hotelStore}
}

func (h *HotelHandler) Search(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	regionID, _ := strconv.Atoi(c.Query("region_id"))
	minPrice, _ := strconv.ParseFloat(c.Query("min_price"), 64)
	maxPrice, _ := strconv.ParseFloat(c.Query("max_price"), 64)

	filter := store.HotelFilter{
		RegionID: uint(regionID),
		Keyword:  c.Query("keyword"),
		MinPrice: minPrice,
		MaxPrice: maxPrice,
		SortBy:   c.DefaultQuery("sort_by", "recommend"),
		Page:     page,
		PageSize: pageSize,
	}

	if sr := c.Query("star_rating"); sr != "" {
		for _, s := range strings.Split(sr, ",") {
			if v, err := strconv.Atoi(strings.TrimSpace(s)); err == nil {
				filter.StarRatings = append(filter.StarRatings, v)
			}
		}
	}

	if at := c.Query("accommodation_type"); at != "" {
		for _, t := range strings.Split(at, ",") {
			if v := strings.TrimSpace(t); v != "" {
				filter.AccommodationTypes = append(filter.AccommodationTypes, v)
			}
		}
	}

	if fac := c.Query("facilities"); fac != "" {
		for _, f := range strings.Split(fac, ",") {
			if v := strings.TrimSpace(f); v != "" {
				filter.Facilities = append(filter.Facilities, v)
			}
		}
	}

	products, total, err := h.hotelStore.Search(filter)
	if err != nil {
		response.ServerError(c, "Failed to search hotels")
		return
	}

	response.Paginated(c, products, total, page, pageSize)
}
