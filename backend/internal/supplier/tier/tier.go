package tier

// Tier levels
const (
	Silver  = "silver"
	Gold    = "gold"
	Diamond = "diamond"
)

// Calculate determines supplier tier based on order count, rating, and cancel rate.
func Calculate(orderCount int64, avgRating float64, cancelRate float64) string {
	if orderCount >= 200 && avgRating >= 4.5 && cancelRate < 3 {
		return Diamond
	}
	if orderCount >= 50 && avgRating >= 4.0 && cancelRate < 5 {
		return Gold
	}
	return Silver
}
