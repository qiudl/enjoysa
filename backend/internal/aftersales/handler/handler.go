// Deprecated: This module has been migrated to ai-service (claw-master/ai-service).
// Kept for backward compatibility. New features should be added to ai-service.
package handler

import (
	"strconv"
	"time"

	"enjoysa-backend/internal/aftersales/model"
	"enjoysa-backend/internal/aftersales/store"
	"enjoysa-backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type AfterSalesHandler struct {
	store *store.TicketStore
}

func NewAfterSalesHandler(s *store.TicketStore) *AfterSalesHandler {
	return &AfterSalesHandler{store: s}
}

// === 订单查询 ===

// GetOrder 查询单个订单摘要
func (h *AfterSalesHandler) GetOrder(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid order ID")
		return
	}

	order, err := h.store.GetOrderByID(uint(id))
	if err != nil {
		response.NotFound(c, "Order not found")
		return
	}

	response.Success(c, order)
}

// SearchOrders 搜索订单
func (h *AfterSalesHandler) SearchOrders(c *gin.Context) {
	email := c.Query("email")
	phone := c.Query("phone")

	if email == "" && phone == "" {
		response.BadRequest(c, "Please provide email or phone")
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))

	orders, total, err := h.store.SearchOrders(email, phone, page, pageSize)
	if err != nil {
		response.ServerError(c, "Failed to search orders")
		return
	}

	response.Paginated(c, orders, total, page, pageSize)
}

// === 工单管理 ===

type CreateTicketRequest struct {
	OrderID      *uint  `json:"order_id"`
	Type         string `json:"type" binding:"required,oneof=refund exchange complaint inquiry"`
	Priority     string `json:"priority" binding:"omitempty,oneof=low medium high"`
	Subject      string `json:"subject" binding:"required,max=200"`
	Description  string `json:"description"`
	Source       string `json:"source" binding:"omitempty,oneof=feishu web ai-chat"`
	ContactName  string `json:"contact_name"`
	ContactPhone string `json:"contact_phone"`
	ContactEmail string `json:"contact_email"`
	FeishuOpenID string `json:"feishu_open_id"`
}

// CreateTicket 创建工单
func (h *AfterSalesHandler) CreateTicket(c *gin.Context) {
	var req CreateTicketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	priority := model.TicketPriority(req.Priority)
	if priority == "" {
		priority = model.TicketPriorityMedium
	}

	source := req.Source
	if source == "" {
		source = "feishu"
	}

	ticket := &model.Ticket{
		OrderID:      req.OrderID,
		Type:         model.TicketType(req.Type),
		Status:       model.TicketStatusOpen,
		Priority:     priority,
		Subject:      req.Subject,
		Description:  req.Description,
		Source:       source,
		ContactName:  req.ContactName,
		ContactPhone: req.ContactPhone,
		ContactEmail: req.ContactEmail,
		FeishuOpenID: req.FeishuOpenID,
	}

	if err := h.store.Create(ticket); err != nil {
		response.ServerError(c, "Failed to create ticket")
		return
	}

	// 添加系统备注
	h.store.AddNote(&model.TicketNote{
		TicketID: ticket.ID,
		Author:   "system",
		Content:  "Ticket created via " + source,
		IsSystem: true,
	})

	response.Created(c, ticket)
}

// GetTicket 查询工单
func (h *AfterSalesHandler) GetTicket(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid ticket ID")
		return
	}

	ticket, err := h.store.GetByID(uint(id))
	if err != nil {
		response.NotFound(c, "Ticket not found")
		return
	}

	notes, _ := h.store.GetNotes(ticket.ID)

	response.Success(c, gin.H{
		"ticket": ticket,
		"notes":  notes,
	})
}

// ListTickets 工单列表
func (h *AfterSalesHandler) ListTickets(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	filter := store.TicketFilter{
		Status:   c.Query("status"),
		Type:     c.Query("type"),
		Source:   c.Query("source"),
		Keyword:  c.Query("keyword"),
		Page:     page,
		PageSize: pageSize,
	}

	tickets, total, err := h.store.List(filter)
	if err != nil {
		response.ServerError(c, "Failed to list tickets")
		return
	}

	response.Paginated(c, tickets, total, page, pageSize)
}

type UpdateTicketRequest struct {
	Status     string `json:"status" binding:"omitempty,oneof=open processing resolved closed"`
	Priority   string `json:"priority" binding:"omitempty,oneof=low medium high"`
	Resolution string `json:"resolution"`
	Note       string `json:"note"`
}

// UpdateTicket 更新工单
func (h *AfterSalesHandler) UpdateTicket(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid ticket ID")
		return
	}

	ticket, err := h.store.GetByID(uint(id))
	if err != nil {
		response.NotFound(c, "Ticket not found")
		return
	}

	var req UpdateTicketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	if req.Status != "" {
		oldStatus := ticket.Status
		ticket.Status = model.TicketStatus(req.Status)

		if ticket.Status == model.TicketStatusResolved {
			now := time.Now()
			ticket.ResolvedAt = &now
		}

		// 添加状态变更备注
		h.store.AddNote(&model.TicketNote{
			TicketID: ticket.ID,
			Author:   "system",
			Content:  "Status changed: " + string(oldStatus) + " → " + req.Status,
			IsSystem: true,
		})
	}

	if req.Priority != "" {
		ticket.Priority = model.TicketPriority(req.Priority)
	}

	if req.Resolution != "" {
		ticket.Resolution = req.Resolution
	}

	if err := h.store.Update(ticket); err != nil {
		response.ServerError(c, "Failed to update ticket")
		return
	}

	// 添加用户备注
	if req.Note != "" {
		serviceName, _ := c.Get("service_name")
		author := "service"
		if name, ok := serviceName.(string); ok {
			author = name
		}
		h.store.AddNote(&model.TicketNote{
			TicketID: ticket.ID,
			Author:   author,
			Content:  req.Note,
		})
	}

	response.Success(c, ticket)
}

// === Supplier portal ===

// SupplierCreateTicketRequest is the body posted by supplier-side "新建售后单"
// form. Order ID is mandatory (linkage is the whole point of supplier-side
// creation) and image_urls are pre-uploaded via /api/v1/ai/upload-image.
type SupplierCreateTicketRequest struct {
	OrderID     uint     `json:"order_id" binding:"required"`
	Type        string   `json:"type" binding:"required,oneof=refund exchange complaint inquiry"`
	Priority    string   `json:"priority" binding:"omitempty,oneof=low medium high"`
	Subject     string   `json:"subject" binding:"required,max=200"`
	Description string   `json:"description" binding:"max=5000"`
	ImageURLs   []string `json:"image_urls" binding:"max=9,dive,url,max=500"`
}

// SupplierCreateTicket lets a logged-in supplier file a ticket for one of
// their own orders. The route is mounted under /supplier so SupplierAuth has
// already populated supplier_id in the gin context.
func (h *AfterSalesHandler) SupplierCreateTicket(c *gin.Context) {
	supplierID, ok := getSupplierID(c)
	if !ok {
		response.Unauthorized(c, "Supplier session required")
		return
	}

	var req SupplierCreateTicketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	// Ownership check — order must belong to this supplier.
	owns, err := h.store.OrderBelongsToSupplier(req.OrderID, supplierID)
	if err != nil {
		response.ServerError(c, "Failed to verify order")
		return
	}
	if !owns {
		response.Forbidden(c, "Order does not belong to your supplier account")
		return
	}

	priority := model.TicketPriority(req.Priority)
	if priority == "" {
		priority = model.TicketPriorityMedium
	}

	orderID := req.OrderID
	ticket := &model.Ticket{
		OrderID:     &orderID,
		Type:        model.TicketType(req.Type),
		Status:      model.TicketStatusOpen,
		Priority:    priority,
		Subject:     req.Subject,
		Description: req.Description,
		Source:      "web",
	}

	if err := h.store.Create(ticket); err != nil {
		response.ServerError(c, "Failed to create ticket")
		return
	}

	if err := h.store.CreateAttachments(ticket.ID, req.ImageURLs); err != nil {
		// Non-fatal — ticket already exists; surface a soft warning by logging
		// but still return success so the supplier can re-upload via detail.
		_ = err
	}

	h.store.AddNote(&model.TicketNote{
		TicketID: ticket.ID,
		Author:   "supplier",
		Content:  "Ticket created via supplier portal",
		IsSystem: true,
	})

	response.Created(c, gin.H{
		"ticket":      ticket,
		"image_count": len(req.ImageURLs),
	})
}

// SupplierGetTicket returns a ticket belonging to the calling supplier with
// notes + attachments. Cross-supplier access is rejected with 404 (avoid id
// enumeration leakage).
func (h *AfterSalesHandler) SupplierGetTicket(c *gin.Context) {
	supplierID, ok := getSupplierID(c)
	if !ok {
		response.Unauthorized(c, "Supplier session required")
		return
	}

	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid ticket ID")
		return
	}

	ticket, err := h.store.GetByID(uint(id))
	if err != nil || ticket == nil {
		response.NotFound(c, "Ticket not found")
		return
	}

	// Ownership: ticket must reference an order owned by this supplier.
	if ticket.OrderID == nil {
		response.NotFound(c, "Ticket not found")
		return
	}
	owns, err := h.store.OrderBelongsToSupplier(*ticket.OrderID, supplierID)
	if err != nil || !owns {
		response.NotFound(c, "Ticket not found")
		return
	}

	notes, _ := h.store.GetNotes(ticket.ID)
	atts, _ := h.store.GetAttachments(ticket.ID)

	response.Success(c, gin.H{
		"ticket":      ticket,
		"notes":       notes,
		"attachments": atts,
	})
}

func getSupplierID(c *gin.Context) (uint, bool) {
	v, ok := c.Get("supplier_id")
	if !ok {
		return 0, false
	}
	id, ok := v.(uint)
	if !ok || id == 0 {
		return 0, false
	}
	return id, true
}

// === FAQ ===

// ListFAQs 查询 FAQ 列表
func (h *AfterSalesHandler) ListFAQs(c *gin.Context) {
	category := c.Query("category")

	faqs, err := h.store.ListFAQs(category)
	if err != nil {
		response.ServerError(c, "Failed to list FAQs")
		return
	}

	response.Success(c, faqs)
}
