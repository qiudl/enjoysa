package handler

import (
	"strconv"
	"time"

	"enjoysa-backend/internal/models"
	"enjoysa-backend/internal/usercontact/model"
	"enjoysa-backend/internal/usercontact/store"
	"enjoysa-backend/pkg/response"

	"github.com/gin-gonic/gin"
)

const maxContacts = 20

type UserContactHandler struct {
	store *store.UserContactStore
}

func NewUserContactHandler(s *store.UserContactStore) *UserContactHandler {
	return &UserContactHandler{store: s}
}

type ContactRequest struct {
	FirstName           string `json:"first_name" binding:"required,max=50"`
	LastName            string `json:"last_name" binding:"required,max=50"`
	Email               string `json:"email" binding:"omitempty,email,max=100"`
	Phone               string `json:"phone" binding:"omitempty,max=20"`
	DateOfBirth         string `json:"date_of_birth"`
	Nationality         string `json:"nationality" binding:"omitempty,max=50"`
	PassportNumber      string `json:"passport_number" binding:"omitempty,max=30"`
	DefaultType         string `json:"default_type" binding:"omitempty,oneof=adult child infant"`
	IsSelf              bool   `json:"is_self"`
	SpecialRequirements string `json:"special_requirements" binding:"omitempty,max=500"`
}

type ContactResponse struct {
	ID                  uint   `json:"id"`
	FirstName           string `json:"first_name"`
	LastName            string `json:"last_name"`
	Email               string `json:"email"`
	Phone               string `json:"phone"`
	DateOfBirth         string `json:"date_of_birth,omitempty"`
	Nationality         string `json:"nationality"`
	PassportNumber      string `json:"passport_number"` // masked
	DefaultType         string `json:"default_type"`
	IsSelf              bool   `json:"is_self"`
	SpecialRequirements string `json:"special_requirements"`
}

func toResponse(c *model.UserContact) ContactResponse {
	dob := ""
	if c.DateOfBirth != nil {
		dob = c.DateOfBirth.Format("2006-01-02")
	}
	return ContactResponse{
		ID:                  c.ID,
		FirstName:           c.FirstName,
		LastName:            c.LastName,
		Email:               c.Email,
		Phone:               c.Phone,
		DateOfBirth:         dob,
		Nationality:         c.Nationality,
		PassportNumber:      model.MaskPassport(c.PassportNumber),
		DefaultType:         c.DefaultType,
		IsSelf:              c.IsSelf,
		SpecialRequirements: c.SpecialRequirements,
	}
}

func getUser(c *gin.Context) *models.User {
	u, exists := c.Get("user")
	if !exists {
		return nil
	}
	return u.(*models.User)
}

// List returns all contacts for the current user
func (h *UserContactHandler) List(c *gin.Context) {
	user := getUser(c)
	if user == nil {
		response.Unauthorized(c, "Not authenticated")
		return
	}

	contacts, err := h.store.ListByUserID(user.ID)
	if err != nil {
		response.ServerError(c, "Failed to list contacts")
		return
	}

	items := make([]ContactResponse, len(contacts))
	for i, ct := range contacts {
		items[i] = toResponse(&ct)
	}

	response.Success(c, gin.H{
		"contacts": items,
		"total":    len(items),
		"limit":    maxContacts,
	})
}

// Create adds a new contact
func (h *UserContactHandler) Create(c *gin.Context) {
	user := getUser(c)
	if user == nil {
		response.Unauthorized(c, "Not authenticated")
		return
	}

	var req ContactRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	// Check limit
	count, err := h.store.CountByUserID(user.ID)
	if err != nil {
		response.ServerError(c, "Failed to check contact count")
		return
	}
	if count >= maxContacts {
		response.BadRequest(c, "Contact limit reached (max 20)")
		return
	}

	contact := &model.UserContact{
		UserID:              user.ID,
		FirstName:           req.FirstName,
		LastName:            req.LastName,
		Email:               req.Email,
		Phone:               req.Phone,
		Nationality:         req.Nationality,
		DefaultType:         req.DefaultType,
		IsSelf:              req.IsSelf,
		SpecialRequirements: req.SpecialRequirements,
	}

	if contact.DefaultType == "" {
		contact.DefaultType = "adult"
	}

	// Parse date of birth
	if req.DateOfBirth != "" {
		t, err := parseDate(req.DateOfBirth)
		if err != nil {
			response.BadRequest(c, "Invalid date_of_birth format, use YYYY-MM-DD")
			return
		}
		contact.DateOfBirth = &t
	}

	// Encrypt passport
	if req.PassportNumber != "" {
		encrypted, err := model.Encrypt(req.PassportNumber)
		if err != nil {
			response.ServerError(c, "Failed to encrypt passport number")
			return
		}
		contact.PassportNumber = encrypted
	}

	if err := h.store.Create(contact); err != nil {
		response.ServerError(c, "Failed to create contact")
		return
	}

	response.Created(c, toResponse(contact))
}

// Update modifies an existing contact
func (h *UserContactHandler) Update(c *gin.Context) {
	user := getUser(c)
	if user == nil {
		response.Unauthorized(c, "Not authenticated")
		return
	}

	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid ID")
		return
	}

	contact, err := h.store.GetByID(uint(id), user.ID)
	if err != nil {
		response.NotFound(c, "Contact not found")
		return
	}

	var req ContactRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	contact.FirstName = req.FirstName
	contact.LastName = req.LastName
	contact.Email = req.Email
	contact.Phone = req.Phone
	contact.Nationality = req.Nationality
	contact.IsSelf = req.IsSelf
	contact.SpecialRequirements = req.SpecialRequirements

	if req.DefaultType != "" {
		contact.DefaultType = req.DefaultType
	}

	if req.DateOfBirth != "" {
		t, err := parseDate(req.DateOfBirth)
		if err != nil {
			response.BadRequest(c, "Invalid date_of_birth format, use YYYY-MM-DD")
			return
		}
		contact.DateOfBirth = &t
	} else {
		contact.DateOfBirth = nil
	}

	if req.PassportNumber != "" {
		encrypted, err := model.Encrypt(req.PassportNumber)
		if err != nil {
			response.ServerError(c, "Failed to encrypt passport number")
			return
		}
		contact.PassportNumber = encrypted
	} else {
		contact.PassportNumber = ""
	}

	if err := h.store.Update(contact); err != nil {
		response.ServerError(c, "Failed to update contact")
		return
	}

	response.Success(c, toResponse(contact))
}

// Delete removes a contact
func (h *UserContactHandler) Delete(c *gin.Context) {
	user := getUser(c)
	if user == nil {
		response.Unauthorized(c, "Not authenticated")
		return
	}

	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid ID")
		return
	}

	if err := h.store.Delete(uint(id), user.ID); err != nil {
		response.ServerError(c, "Failed to delete contact")
		return
	}

	response.SuccessMessage(c, "Contact deleted")
}

func parseDate(s string) (time.Time, error) {
	return time.Parse("2006-01-02", s)
}
