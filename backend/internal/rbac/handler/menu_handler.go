package handler

import (
	"strconv"

	"enjoysa-backend/internal/rbac/model"
	"enjoysa-backend/internal/rbac/store"
	"enjoysa-backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type MenuHandler struct {
	menuStore *store.MenuStore
}

func NewMenuHandler(ms *store.MenuStore) *MenuHandler {
	return &MenuHandler{menuStore: ms}
}

// ListTree returns the full menu tree.
func (h *MenuHandler) ListTree(c *gin.Context) {
	menus, err := h.menuStore.List()
	if err != nil {
		response.ServerError(c, "Failed to list menus")
		return
	}
	tree := store.BuildTree(menus)
	response.Success(c, tree)
}

type CreateMenuRequest struct {
	ParentID  uint   `json:"parent_id"`
	Name      string `json:"name" binding:"required"`
	Title     string `json:"title" binding:"required"`
	TitleZh   string `json:"title_zh"`
	Icon      string `json:"icon"`
	Path      string `json:"path"`
	Authority string `json:"authority"`
	MenuType  int    `json:"menu_type"`
	Method    string `json:"method"`
	ApiPath   string `json:"api_path"`
	SortOrder int    `json:"sort_order"`
	Hidden    bool   `json:"hidden"`
}

func (h *MenuHandler) Create(c *gin.Context) {
	var req CreateMenuRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	menu := &model.SysMenu{
		ParentID:  req.ParentID,
		Name:      req.Name,
		Title:     req.Title,
		TitleZh:   req.TitleZh,
		Icon:      req.Icon,
		Path:      req.Path,
		Authority: req.Authority,
		MenuType:  req.MenuType,
		Method:    req.Method,
		ApiPath:   req.ApiPath,
		SortOrder: req.SortOrder,
		Status:    1,
		Hidden:    req.Hidden,
	}

	if err := h.menuStore.Create(menu); err != nil {
		response.ServerError(c, "Failed to create menu")
		return
	}
	response.Created(c, menu)
}

func (h *MenuHandler) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "Invalid menu ID")
		return
	}

	menu, err := h.menuStore.GetByID(uint(id))
	if err != nil {
		response.NotFound(c, "Menu not found")
		return
	}

	var req CreateMenuRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	menu.ParentID = req.ParentID
	menu.Name = req.Name
	menu.Title = req.Title
	menu.TitleZh = req.TitleZh
	menu.Icon = req.Icon
	menu.Path = req.Path
	menu.Authority = req.Authority
	menu.MenuType = req.MenuType
	menu.Method = req.Method
	menu.ApiPath = req.ApiPath
	menu.SortOrder = req.SortOrder
	menu.Hidden = req.Hidden

	if err := h.menuStore.Update(menu); err != nil {
		response.ServerError(c, "Failed to update menu")
		return
	}
	response.Success(c, menu)
}

func (h *MenuHandler) Delete(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "Invalid menu ID")
		return
	}

	if err := h.menuStore.Delete(uint(id)); err != nil {
		response.ServerError(c, "Failed to delete menu")
		return
	}
	response.SuccessMessage(c, "Menu deleted")
}
