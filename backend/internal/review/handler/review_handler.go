package handler

import (
	"fmt"
	"strconv"
	"time"

	"enjoysa-backend/internal/models"
	notifservice "enjoysa-backend/internal/notification/service"
	orderstore "enjoysa-backend/internal/order/store"
	productstore "enjoysa-backend/internal/product/store"
	"enjoysa-backend/internal/review/model"
	"enjoysa-backend/internal/review/store"
	"enjoysa-backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type ReviewHandler struct {
	reviewStore  *store.ReviewStore
	orderStore   *orderstore.OrderStore
	productStore *productstore.ProductStore
	notifSvc     *notifservice.NotificationService
}

func NewReviewHandler(
	reviewStore *store.ReviewStore,
	orderStore *orderstore.OrderStore,
	productStore *productstore.ProductStore,
	notifSvc *notifservice.NotificationService,
) *ReviewHandler {
	return &ReviewHandler{
		reviewStore:  reviewStore,
		orderStore:   orderStore,
		productStore: productStore,
		notifSvc:     notifSvc,
	}
}

// CreateReview POST /orders/:id/review (userAuth)
func (h *ReviewHandler) CreateReview(c *gin.Context) {
	user := c.MustGet("user").(*models.User)
	orderID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "Invalid order ID")
		return
	}

	order, err := h.orderStore.GetByID(uint(orderID))
	if err != nil {
		response.NotFound(c, "Order not found")
		return
	}

	if order.UserID != user.ID {
		response.Forbidden(c, "Not your order")
		return
	}

	if order.Status != "completed" {
		response.BadRequest(c, "Can only review completed orders")
		return
	}

	// Check duplicate
	if _, err := h.reviewStore.GetByOrderID(uint(orderID)); err == nil {
		response.BadRequest(c, "You already reviewed this order")
		return
	}

	var req struct {
		Rating  int    `json:"rating" binding:"required,min=1,max=5"`
		Content string `json:"content" binding:"required"`
		Photos  string `json:"photos"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	if req.Photos == "" {
		req.Photos = "[]"
	}

	review := &model.Review{
		OrderID:    uint(orderID),
		UserID:     user.ID,
		SupplierID: order.SupplierID,
		ProductID:  order.ProductID,
		Rating:     req.Rating,
		Content:    req.Content,
		Photos:     req.Photos,
		Status:     "published",
	}

	if err := h.reviewStore.Create(review); err != nil {
		response.ServerError(c, "Failed to create review")
		return
	}

	// Notify supplier
	if h.notifSvc != nil {
		_ = h.notifSvc.Send("supplier", review.SupplierID, "new_review",
			"New Review Received",
			fmt.Sprintf("%d-star review for %s", review.Rating, order.ProductName),
			"review", review.ID)
	}

	// Update product rating
	h.updateProductRating(order.ProductID)

	response.Created(c, review)
}

func (h *ReviewHandler) updateProductRating(productID uint) {
	product, err := h.productStore.GetByID(productID)
	if err != nil {
		return
	}

	// Fetch all published reviews for this product
	allReviews, total, _ := h.reviewStore.ListByProduct(productID, 1, 10000)
	product.ReviewCount = int(total)

	if total > 0 {
		var sum float64
		for _, r := range allReviews {
			sum += float64(r.Rating)
		}
		product.Rating = sum / float64(len(allReviews))
	}

	h.productStore.Update(product)
}

// ListProductReviews GET /products/:id/reviews (public)
func (h *ReviewHandler) ListProductReviews(c *gin.Context) {
	productID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "Invalid product ID")
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	reviews, total, err := h.reviewStore.ListByProduct(uint(productID), page, pageSize)
	if err != nil {
		response.ServerError(c, "Failed to list reviews")
		return
	}

	response.Paginated(c, reviews, total, page, pageSize)
}

// SupplierListReviews GET /supplier/reviews (supplierAuth)
func (h *ReviewHandler) SupplierListReviews(c *gin.Context) {
	supplierID, _ := c.Get("supplier_id")

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	filter := store.ReviewFilter{
		SupplierID: supplierID.(uint),
		Page:       page,
		PageSize:   pageSize,
	}

	if status := c.Query("status"); status != "" {
		filter.Status = status
	}
	if rating := c.Query("rating"); rating != "" {
		r, _ := strconv.Atoi(rating)
		filter.Rating = r
	}
	if hasReply := c.Query("has_reply"); hasReply != "" {
		v := hasReply == "true"
		filter.HasReply = &v
	}

	reviews, total, err := h.reviewStore.ListBySupplier(filter)
	if err != nil {
		response.ServerError(c, "Failed to list reviews")
		return
	}

	response.Paginated(c, reviews, total, page, pageSize)
}

// SupplierGetStats GET /supplier/reviews/stats (supplierAuth)
func (h *ReviewHandler) SupplierGetStats(c *gin.Context) {
	supplierID, _ := c.Get("supplier_id")

	stats, err := h.reviewStore.GetStats(supplierID.(uint))
	if err != nil {
		response.ServerError(c, "Failed to get review stats")
		return
	}

	response.Success(c, stats)
}

// SupplierReply POST /supplier/reviews/:id/reply (supplierAuth)
func (h *ReviewHandler) SupplierReply(c *gin.Context) {
	supplierID, _ := c.Get("supplier_id")
	supplierUserID, _ := c.Get("supplier_user_id")

	reviewID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "Invalid review ID")
		return
	}

	review, err := h.reviewStore.GetByID(uint(reviewID))
	if err != nil {
		response.NotFound(c, "Review not found")
		return
	}

	if review.SupplierID != supplierID.(uint) {
		response.Forbidden(c, "Not your review")
		return
	}

	var req struct {
		Reply string `json:"reply" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	if err := h.reviewStore.UpdateReply(uint(reviewID), req.Reply, supplierUserID.(uint)); err != nil {
		response.ServerError(c, "Failed to update reply")
		return
	}

	review.Reply = req.Reply
	now := time.Now()
	review.RepliedAt = &now
	uid := supplierUserID.(uint)
	review.RepliedBy = &uid

	response.Success(c, review)
}

// AdminListReviews GET /admin/reviews (adminAuth)
func (h *ReviewHandler) AdminListReviews(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	status := c.Query("status")

	reviews, total, err := h.reviewStore.ListAll(page, pageSize, status)
	if err != nil {
		response.ServerError(c, "Failed to list reviews")
		return
	}

	response.Paginated(c, reviews, total, page, pageSize)
}

// AdminUpdateStatus PUT /admin/reviews/:id/status (adminAuth)
func (h *ReviewHandler) AdminUpdateStatus(c *gin.Context) {
	reviewID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "Invalid review ID")
		return
	}

	var req struct {
		Status string `json:"status" binding:"required,oneof=published hidden"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	if err := h.reviewStore.UpdateStatus(uint(reviewID), req.Status); err != nil {
		response.ServerError(c, "Failed to update status")
		return
	}

	response.SuccessMessage(c, "Status updated")
}
