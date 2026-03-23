package seed

import "fmt"

// South Australia themed Unsplash photo IDs
var unsplashPhotos = map[string][]string{
	"kangaroo_island": {
		"1507003211169-0a1dd7228f2d", // coastline
		"1564349683136-77e08dba1ef7", // seal bay
		"1506905925346-21bda4d32df4", // remarkable rocks
		"1518709268805-4e9042af9f23", // lighthouse
		"1502680390548-bdbf31e3e3d3", // beach
	},
	"barossa": {
		"1506377247377-2a5b3b417ebb", // vineyard
		"1560493676-04071c5f467b",    // wine cellar
		"1516594915697-87eb3b1c14ea", // wine glasses
		"1504279577054-acfeccf8fc52", // grape harvest
		"1559526324-593bc073d938",    // rolling hills
	},
	"adelaide": {
		"1514580426463-fd77dc29d0e0", // city skyline
		"1517248135467-4c7edcad34c4", // market
		"1513635269975-59663e0ac1ad", // architecture
		"1519501025264-65ba15a82390", // park
		"1502175353174-a7a70e73b4b3", // street
	},
	"wildlife": {
		"1535338454528-13c7f1df1d4b", // koala
		"1570481662006-a3a1374699e8", // kangaroo
		"1497752531616-c3afd9760a11", // parrot
		"1474511320723-9a56873e68c2", // wildlife park
		"1551085254-e96b210db58a",    // wombat
	},
	"water": {
		"1544551763-46a013bb70d5", // murray river
		"1507525428034-b723cf961d3e", // cruise
		"1468413253725-0d5181091126", // kayak
		"1559825481-12a05cc00344",    // sunset water
		"1505881402510-4e2a3d4c7c49", // river landscape
	},
	"adventure": {
		"1551632811-561732d1e306", // hiking
		"1464822759023-fed622ff2c3b", // camping
		"1501555088652-021faa159db6", // mountain biking
		"1533692328991-08159ff19fca", // 4WD
		"1517649763962-0c623066013b", // rock climbing
	},
	"food": {
		"1414235077428-338989a2e8c0", // restaurant
		"1504674900247-0877df9cc836", // cheese platter
		"1528823872057-9c018a7a7553", // seafood
		"1551218808983-2e85b14bce49", // farm produce
		"1499028344343-cd173ffc68a0", // cafe
	},
	"accommodation": {
		"1566073771259-6a6300d76f3c", // hotel
		"1520250497591-112f2f40a3f4", // lodge
		"1582719508461-905c673771f1", // cabin
		"1571896349842-33c89424de2d", // resort
		"1551882547-ff40c63fe5fa",    // beach house
	},
}

func unsplashURL(photoID string, w, h int) string {
	return fmt.Sprintf("https://images.unsplash.com/photo-%s?w=%d&h=%d&fit=crop&auto=format", photoID, w, h)
}

func supplierLogo(index int) string {
	categories := []string{"adelaide", "barossa", "kangaroo_island", "wildlife", "water"}
	cat := categories[index%len(categories)]
	photos := unsplashPhotos[cat]
	return unsplashURL(photos[index%len(photos)], 200, 200)
}

func productImage(supplierIdx, productIdx, imageIdx int) string {
	categories := []string{"kangaroo_island", "barossa", "adelaide", "wildlife", "water", "adventure", "food", "accommodation"}
	cat := categories[(supplierIdx+productIdx)%len(categories)]
	photos := unsplashPhotos[cat]
	return unsplashURL(photos[(productIdx+imageIdx)%len(photos)], 800, 600)
}

func bannerImage(index int) string {
	categories := []string{"kangaroo_island", "barossa", "adelaide", "water", "wildlife"}
	cat := categories[index%len(categories)]
	photos := unsplashPhotos[cat]
	return unsplashURL(photos[0], 1920, 600)
}

func regionImage(index int) string {
	categories := []string{"adelaide", "barossa", "kangaroo_island", "adventure", "water", "accommodation", "wildlife"}
	cat := categories[index%len(categories)]
	photos := unsplashPhotos[cat]
	return unsplashURL(photos[1], 800, 400)
}

func unsplashHotel(index int) string {
	photos := unsplashPhotos["accommodation"]
	return unsplashURL(photos[index%len(photos)], 800, 600)
}

func unsplashHotelRoom(index int) string {
	photos := unsplashPhotos["accommodation"]
	return unsplashURL(photos[(index+2)%len(photos)], 800, 600)
}
