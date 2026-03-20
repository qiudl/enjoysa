package email

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"

	"enjoysa-backend/internal/core/config"
	"enjoysa-backend/internal/core/logger"
)

type ResendService struct {
	apiKey      string
	fromAddress string
}

func NewResendService(cfg config.ResendConfig) *ResendService {
	return &ResendService{
		apiKey:      cfg.APIKey,
		fromAddress: cfg.FromAddress,
	}
}

type resendRequest struct {
	From    string `json:"from"`
	To      []string `json:"to"`
	Subject string `json:"subject"`
	HTML    string `json:"html"`
}

func (s *ResendService) SendPasswordResetEmail(toEmail, userName, resetLink, lang string) error {
	if s.apiKey == "" {
		logger.Warn("Resend API key not configured, skipping email send")
		return nil
	}

	subject, html := s.buildResetEmailContent(userName, resetLink, lang)

	payload := resendRequest{
		From:    s.fromAddress,
		To:      []string{toEmail},
		Subject: subject,
		HTML:    html,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal email payload: %w", err)
	}

	req, err := http.NewRequest("POST", "https://api.resend.com/emails", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("send email: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("resend API returned status %d", resp.StatusCode)
	}

	logger.Infof("Password reset email sent to %s", toEmail)
	return nil
}

func (s *ResendService) buildResetEmailContent(userName, resetLink, lang string) (string, string) {
	if lang == "zh" {
		subject := "畅游南澳 — 重置您的密码"
		html := fmt.Sprintf(`<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;color:#333;">
<div style="text-align:center;margin-bottom:32px;">
  <h1 style="color:#0066FF;font-size:28px;margin:0;">畅游南澳</h1>
  <p style="color:#64748b;font-size:14px;margin:4px 0 0;">EnjoySA</p>
</div>
<h2 style="font-size:20px;margin-bottom:16px;">您好%s，</h2>
<p style="font-size:15px;line-height:1.6;">我们收到了重置您账户密码的请求。请点击下方按钮设置新密码：</p>
<div style="text-align:center;margin:32px 0;">
  <a href="%s" style="display:inline-block;padding:14px 32px;background:#0066FF;color:#fff;text-decoration:none;border-radius:8px;font-size:16px;font-weight:600;">重置密码</a>
</div>
<p style="font-size:13px;color:#64748b;line-height:1.6;">此链接将在 1 小时后过期。如果您没有请求重置密码，请忽略此邮件。</p>
<p style="font-size:13px;color:#94a3b8;margin-top:8px;">如果按钮无法点击，请复制以下链接到浏览器：<br><a href="%s" style="color:#0066FF;word-break:break-all;">%s</a></p>
<hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0;">
<p style="font-size:12px;color:#94a3b8;text-align:center;">© 2026 畅游南澳 EnjoySA. All rights reserved.</p>
</body></html>`, s.namePrefix(userName), resetLink, resetLink, resetLink)
		return subject, html
	}

	subject := "EnjoySA — Reset Your Password"
	html := fmt.Sprintf(`<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px;color:#333;">
<div style="text-align:center;margin-bottom:32px;">
  <h1 style="color:#0066FF;font-size:28px;margin:0;">EnjoySA</h1>
  <p style="color:#64748b;font-size:14px;margin:4px 0 0;">Enjoy South Australia</p>
</div>
<h2 style="font-size:20px;margin-bottom:16px;">Hi%s,</h2>
<p style="font-size:15px;line-height:1.6;">We received a request to reset your account password. Click the button below to set a new password:</p>
<div style="text-align:center;margin:32px 0;">
  <a href="%s" style="display:inline-block;padding:14px 32px;background:#0066FF;color:#fff;text-decoration:none;border-radius:8px;font-size:16px;font-weight:600;">Reset Password</a>
</div>
<p style="font-size:13px;color:#64748b;line-height:1.6;">This link will expire in 1 hour. If you didn't request a password reset, please ignore this email.</p>
<p style="font-size:13px;color:#94a3b8;margin-top:8px;">If the button doesn't work, copy and paste this link into your browser:<br><a href="%s" style="color:#0066FF;word-break:break-all;">%s</a></p>
<hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0;">
<p style="font-size:12px;color:#94a3b8;text-align:center;">© 2026 EnjoySA. All rights reserved.</p>
</body></html>`, s.namePrefix(userName), resetLink, resetLink, resetLink)
	return subject, html
}

func (s *ResendService) namePrefix(name string) string {
	if name != "" {
		return " " + name
	}
	return ""
}
