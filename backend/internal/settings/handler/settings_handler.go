package handler

import (
	"enjoysa-backend/internal/settings/store"
	"enjoysa-backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type SettingsHandler struct {
	store *store.SettingsStore
}

func NewSettingsHandler(s *store.SettingsStore) *SettingsHandler {
	return &SettingsHandler{store: s}
}

// GetAll returns all settings grouped by category
func (h *SettingsHandler) GetAll(c *gin.Context) {
	settings, err := h.store.GetAll()
	if err != nil {
		response.ServerError(c, "Failed to get settings")
		return
	}

	// Group by category
	grouped := make(map[string]map[string]string)
	for _, s := range settings {
		if grouped[s.Group] == nil {
			grouped[s.Group] = make(map[string]string)
		}
		grouped[s.Group][s.Key] = s.Value
	}

	response.Success(c, grouped)
}

// GetByGroup returns settings for a specific group
func (h *SettingsHandler) GetByGroup(c *gin.Context) {
	group := c.Param("group")

	settings, err := h.store.GetByGroup(group)
	if err != nil {
		response.ServerError(c, "Failed to get settings")
		return
	}

	result := make(map[string]string)
	for _, s := range settings {
		result[s.Key] = s.Value
	}

	response.Success(c, result)
}

type UpdateSettingsRequest struct {
	Settings map[string]string `json:"settings" binding:"required"`
}

// Update saves settings for a group
func (h *SettingsHandler) Update(c *gin.Context) {
	group := c.Param("group")

	var req UpdateSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	if err := h.store.BatchSet(req.Settings, group); err != nil {
		response.ServerError(c, "Failed to save settings")
		return
	}

	response.Success(c, nil)
}
