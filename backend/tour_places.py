"""Curated world travel pools and daily place selection for Tour page."""

from __future__ import annotations

import random
from datetime import date, datetime
from typing import Any
from zoneinfo import ZoneInfo

KST = ZoneInfo("Asia/Seoul")

CONTINENT_ORDER = ("Europe", "Asia", "North America", "South America", "Africa", "Oceania")

HOT_PLACES: list[dict[str, str]] = [
    {"slug": "paris-fr", "continent": "Europe", "continent_ko": "유럽", "country": "France", "country_ko": "프랑스", "city": "Paris", "city_ko": "파리", "search_query": "Paris Eiffel Tower travel landscape"},
    {"slug": "rome-it", "continent": "Europe", "continent_ko": "유럽", "country": "Italy", "country_ko": "이탈리아", "city": "Rome", "city_ko": "로마", "search_query": "Rome Colosseum travel landscape"},
    {"slug": "london-uk", "continent": "Europe", "continent_ko": "유럽", "country": "United Kingdom", "country_ko": "영국", "city": "London", "city_ko": "런던", "search_query": "London Big Ben Thames travel landscape"},
    {"slug": "barcelona-es", "continent": "Europe", "continent_ko": "유럽", "country": "Spain", "country_ko": "스페인", "city": "Barcelona", "city_ko": "바르셀로나", "search_query": "Barcelona Sagrada Familia travel"},
    {"slug": "santorini-gr", "continent": "Europe", "continent_ko": "유럽", "country": "Greece", "country_ko": "그리스", "city": "Santorini", "city_ko": "산토리니", "search_query": "Santorini Greece blue domes travel"},
    {"slug": "reykjavik-is", "continent": "Europe", "continent_ko": "유럽", "country": "Iceland", "country_ko": "아이슬란드", "city": "Reykjavik", "city_ko": "레이캬비크", "search_query": "Iceland northern lights landscape travel"},
    {"slug": "tokyo-jp", "continent": "Asia", "continent_ko": "아시아", "country": "Japan", "country_ko": "일본", "city": "Tokyo", "city_ko": "도쿄", "search_query": "Tokyo skyline travel landscape"},
    {"slug": "kyoto-jp", "continent": "Asia", "continent_ko": "아시아", "country": "Japan", "country_ko": "일본", "city": "Kyoto", "city_ko": "교토", "search_query": "Kyoto temple cherry blossom travel"},
    {"slug": "bali-id", "continent": "Asia", "continent_ko": "아시아", "country": "Indonesia", "country_ko": "인도네시아", "city": "Bali", "city_ko": "발리", "search_query": "Bali rice terrace travel landscape"},
    {"slug": "seoul-kr", "continent": "Asia", "continent_ko": "아시아", "country": "South Korea", "country_ko": "대한민국", "city": "Seoul", "city_ko": "서울", "search_query": "Seoul Namsan Tower travel landscape"},
    {"slug": "dubai-ae", "continent": "Asia", "continent_ko": "아시아", "country": "United Arab Emirates", "country_ko": "아랍에미리트", "city": "Dubai", "city_ko": "두바이", "search_query": "Dubai Burj Khalifa travel landscape"},
    {"slug": "singapore-sg", "continent": "Asia", "continent_ko": "아시아", "country": "Singapore", "country_ko": "싱가포르", "city": "Singapore", "city_ko": "싱가포르", "search_query": "Singapore Marina Bay travel landscape"},
    {"slug": "new-york-us", "continent": "North America", "continent_ko": "북아메리카", "country": "United States", "country_ko": "미국", "city": "New York", "city_ko": "뉴욕", "search_query": "New York Manhattan skyline travel"},
    {"slug": "san-francisco-us", "continent": "North America", "continent_ko": "북아메리카", "country": "United States", "country_ko": "미국", "city": "San Francisco", "city_ko": "샌프란시스코", "search_query": "San Francisco Golden Gate Bridge travel"},
    {"slug": "cancun-mx", "continent": "North America", "continent_ko": "북아메리카", "country": "Mexico", "country_ko": "멕시코", "city": "Cancun", "city_ko": "칸쿤", "search_query": "Cancun beach turquoise travel landscape"},
    {"slug": "rio-br", "continent": "South America", "continent_ko": "남아메리카", "country": "Brazil", "country_ko": "브라질", "city": "Rio de Janeiro", "city_ko": "리우데자네이루", "search_query": "Rio de Janeiro Christ the Redeemer travel"},
    {"slug": "cusco-pe", "continent": "South America", "continent_ko": "남아메리카", "country": "Peru", "country_ko": "페루", "city": "Cusco", "city_ko": "쿠스코", "search_query": "Machu Picchu Peru travel landscape"},
    {"slug": "cairo-eg", "continent": "Africa", "continent_ko": "아프리카", "country": "Egypt", "country_ko": "이집트", "city": "Cairo", "city_ko": "카이로", "search_query": "Pyramids Giza Egypt travel landscape"},
    {"slug": "cape-town-za", "continent": "Africa", "continent_ko": "아프리카", "country": "South Africa", "country_ko": "남아프리카", "city": "Cape Town", "city_ko": "케이프타운", "search_query": "Cape Town Table Mountain travel landscape"},
    {"slug": "sydney-au", "continent": "Oceania", "continent_ko": "오세아니아", "country": "Australia", "country_ko": "호주", "city": "Sydney", "city_ko": "시드니", "search_query": "Sydney Opera House harbour travel"},
    {"slug": "bora-bora-pf", "continent": "Oceania", "continent_ko": "오세아니아", "country": "French Polynesia", "country_ko": "프랑스령 폴리네시아", "city": "Bora Bora", "city_ko": "보라보라", "search_query": "Bora Bora lagoon overwater travel"},
    {"slug": "istanbul-tr", "continent": "Europe", "continent_ko": "유럽", "country": "Turkey", "country_ko": "튀르키예", "city": "Istanbul", "city_ko": "이스탄불", "search_query": "Istanbul Hagia Sophia travel landscape"},
    {"slug": "hong-kong-hk", "continent": "Asia", "continent_ko": "아시아", "country": "Hong Kong", "country_ko": "홍콩", "city": "Hong Kong", "city_ko": "홍콩", "search_query": "Hong Kong skyline Victoria Harbour travel"},
    {"slug": "maldives-mv", "continent": "Asia", "continent_ko": "아시아", "country": "Maldives", "country_ko": "몰디브", "city": "Maldives", "city_ko": "몰디브", "search_query": "Maldives beach overwater villa travel"},
]

UNIQUE_PLACES: list[dict[str, str]] = [
    {"slug": "chefchaouen-ma", "continent": "Africa", "continent_ko": "아프리카", "country": "Morocco", "country_ko": "모로코", "city": "Chefchaouen", "city_ko": "셰프샤우엔", "search_query": "Chefchaouen blue city Morocco travel"},
    {"slug": "cappadocia-tr", "continent": "Asia", "continent_ko": "아시아", "country": "Turkey", "country_ko": "튀르키예", "city": "Cappadocia", "city_ko": "카파도키아", "search_query": "Cappadocia hot air balloon travel"},
    {"slug": "uyuni-bo", "continent": "South America", "continent_ko": "남아메리카", "country": "Bolivia", "country_ko": "볼리비아", "city": "Uyuni", "city_ko": "우유니", "search_query": "Salar de Uyuni salt flat mirror travel"},
    {"slug": "meteora-gr", "continent": "Europe", "continent_ko": "유럽", "country": "Greece", "country_ko": "그리스", "city": "Meteora", "city_ko": "메테오라", "search_query": "Meteora monasteries Greece travel"},
    {"slug": "zhangjiajie-cn", "continent": "Asia", "continent_ko": "아시아", "country": "China", "country_ko": "중국", "city": "Zhangjiajie", "city_ko": "장가계", "search_query": "Zhangjiajie avatar mountains travel"},
    {"slug": "faroe-is", "continent": "Europe", "continent_ko": "유럽", "country": "Faroe Islands", "country_ko": "페로 제도", "city": "Faroe Islands", "city_ko": "페로 제도", "search_query": "Faroe Islands grass roof village travel"},
    {"slug": "pamukkale-tr", "continent": "Asia", "continent_ko": "아시아", "country": "Turkey", "country_ko": "튀르키예", "city": "Pamukkale", "city_ko": "파묵칼레", "search_query": "Pamukkale white terraces travel"},
    {"slug": "giethoorn-nl", "continent": "Europe", "continent_ko": "유럽", "country": "Netherlands", "country_ko": "네덜란드", "city": "Giethoorn", "city_ko": "히톤", "search_query": "Giethoorn village canal travel"},
    {"slug": "hallstatt-at", "continent": "Europe", "continent_ko": "유럽", "country": "Austria", "country_ko": "오스트리아", "city": "Hallstatt", "city_ko": "할슈타트", "search_query": "Hallstatt lake village Austria travel"},
    {"slug": "easter-island-cl", "continent": "South America", "continent_ko": "남아메리카", "country": "Chile", "country_ko": "칠레", "city": "Easter Island", "city_ko": "이스터 섬", "search_query": "Easter Island moai statues travel"},
    {"slug": "antelope-canyon-us", "continent": "North America", "continent_ko": "북아메리카", "country": "United States", "country_ko": "미국", "city": "Antelope Canyon", "city_ko": "앤텔로프 캐년", "search_query": "Antelope Canyon slot canyon travel"},
    {"slug": "waitomo-nz", "continent": "Oceania", "continent_ko": "오세아니아", "country": "New Zealand", "country_ko": "뉴질랜드", "city": "Waitomo", "city_ko": "와이토모", "search_query": "Waitomo glowworm caves New Zealand travel"},
    {"slug": "socotra-ye", "continent": "Asia", "continent_ko": "아시아", "country": "Yemen", "country_ko": "예멘", "city": "Socotra", "city_ko": "소코트라", "search_query": "Socotra dragon blood tree travel"},
    {"slug": "colmar-fr", "continent": "Europe", "continent_ko": "유럽", "country": "France", "country_ko": "프랑스", "city": "Colmar", "city_ko": "콜마르", "search_query": "Colmar fairy tale village France travel"},
    {"slug": "svalbard-no", "continent": "Europe", "continent_ko": "유럽", "country": "Norway", "country_ko": "노르웨이", "city": "Svalbard", "city_ko": "스발바르", "search_query": "Longyearbyen Svalbard arctic glacier Norway"},
    {"slug": "lencois-br", "continent": "South America", "continent_ko": "남아메리카", "country": "Brazil", "country_ko": "브라질", "city": "Lençóis Maranhenses", "city_ko": "렌소이스", "search_query": "Lençóis Maranhenses dunes lagoon travel"},
    {"slug": "bhutan-paro", "continent": "Asia", "continent_ko": "아시아", "country": "Bhutan", "country_ko": "부탄", "city": "Paro", "city_ko": "파로", "search_query": "Paro Taktsang Tiger Nest Bhutan travel"},
    {"slug": "wadi-rum-jo", "continent": "Asia", "continent_ko": "아시아", "country": "Jordan", "country_ko": "요르단", "city": "Wadi Rum", "city_ko": "와디 럼", "search_query": "Wadi Rum desert Mars landscape travel"},
]

RESORT_PLACES: list[dict[str, str]] = [
    {"slug": "maldives-resort", "continent": "Asia", "continent_ko": "아시아", "country": "Maldives", "country_ko": "몰디브", "city": "Maldives", "city_ko": "몰디브", "search_query": "Maldives overwater bungalow resort beach"},
    {"slug": "bora-bora-resort", "continent": "Oceania", "continent_ko": "오세아니아", "country": "French Polynesia", "country_ko": "프랑스령 폴리네시아", "city": "Bora Bora", "city_ko": "보라보라", "search_query": "Bora Bora luxury resort lagoon"},
    {"slug": "phuket-th", "continent": "Asia", "continent_ko": "아시아", "country": "Thailand", "country_ko": "태국", "city": "Phuket", "city_ko": "푸켓", "search_query": "Phuket beach resort Thailand tropical"},
    {"slug": "maui-us", "continent": "North America", "continent_ko": "북아메리카", "country": "United States", "country_ko": "미국", "city": "Maui", "city_ko": "마우이", "search_query": "Maui Hawaii beach resort tropical"},
    {"slug": "seychelles-sc", "continent": "Africa", "continent_ko": "아프리카", "country": "Seychelles", "country_ko": "세이셸", "city": "Seychelles", "city_ko": "세이셸", "search_query": "Seychelles beach granite boulders resort"},
    {"slug": "mauritius-mu", "continent": "Africa", "continent_ko": "아프리카", "country": "Mauritius", "country_ko": "모리셔스", "city": "Mauritius", "city_ko": "모리셔스", "search_query": "Mauritius tropical beach resort"},
    {"slug": "fiji-fj", "continent": "Oceania", "continent_ko": "오세아니아", "country": "Fiji", "country_ko": "피지", "city": "Fiji", "city_ko": "피지", "search_query": "Fiji island resort palm beach"},
    {"slug": "koh-samui-th", "continent": "Asia", "continent_ko": "아시아", "country": "Thailand", "country_ko": "태국", "city": "Koh Samui", "city_ko": "코사무이", "search_query": "Koh Samui beach resort Thailand"},
    {"slug": "palawan-ph", "continent": "Asia", "continent_ko": "아시아", "country": "Philippines", "country_ko": "필리핀", "city": "Palawan", "city_ko": "팔라완", "search_query": "Palawan El Nido beach resort Philippines"},
    {"slug": "aruba-aw", "continent": "North America", "continent_ko": "북아메리카", "country": "Aruba", "country_ko": "아루바", "city": "Aruba", "city_ko": "아루바", "search_query": "Aruba Caribbean beach resort"},
    {"slug": "amalfi-it", "continent": "Europe", "continent_ko": "유럽", "country": "Italy", "country_ko": "이탈리아", "city": "Amalfi Coast", "city_ko": "아말피", "search_query": "Amalfi Coast Italy seaside resort"},
    {"slug": "nice-fr", "continent": "Europe", "continent_ko": "유럽", "country": "France", "country_ko": "프랑스", "city": "Nice", "city_ko": "니스", "search_query": "Nice French Riviera beach resort"},
    {"slug": "bali-resort", "continent": "Asia", "continent_ko": "아시아", "country": "Indonesia", "country_ko": "인도네시아", "city": "Bali", "city_ko": "발리", "search_query": "Bali infinity pool resort tropical"},
    {"slug": "zanzibar-tz", "continent": "Africa", "continent_ko": "아프리카", "country": "Tanzania", "country_ko": "탄자니아", "city": "Zanzibar", "city_ko": "잔지바르", "search_query": "Zanzibar white sand beach resort"},
    {"slug": "cancun-resort", "continent": "North America", "continent_ko": "북아메리카", "country": "Mexico", "country_ko": "멕시코", "city": "Cancun", "city_ko": "칸쿤", "search_query": "Cancun all inclusive beach resort"},
    {"slug": "barbados-bb", "continent": "North America", "continent_ko": "북아메리카", "country": "Barbados", "country_ko": "바베이도스", "city": "Barbados", "city_ko": "바베이도스", "search_query": "Barbados Caribbean beach resort"},
    {"slug": "santorini-resort", "continent": "Europe", "continent_ko": "유럽", "country": "Greece", "country_ko": "그리스", "city": "Santorini", "city_ko": "산토리니", "search_query": "Santorini cliff hotel pool sunset"},
    {"slug": "langkawi-my", "continent": "Asia", "continent_ko": "아시아", "country": "Malaysia", "country_ko": "말레이시아", "city": "Langkawi", "city_ko": "랑카위", "search_query": "Langkawi beach resort Malaysia tropical"},
]

HISTORICAL_PLACES: list[dict[str, str]] = [
    {"slug": "rome-hist", "continent": "Europe", "continent_ko": "유럽", "country": "Italy", "country_ko": "이탈리아", "city": "Rome", "city_ko": "로마", "search_query": "Rome Colosseum Roman Forum historical"},
    {"slug": "athens-gr", "continent": "Europe", "continent_ko": "유럽", "country": "Greece", "country_ko": "그리스", "city": "Athens", "city_ko": "아테네", "search_query": "Athens Acropolis Parthenon historical"},
    {"slug": "giza-eg", "continent": "Africa", "continent_ko": "아프리카", "country": "Egypt", "country_ko": "이집트", "city": "Giza", "city_ko": "기자", "search_query": "Pyramids of Giza ancient Egypt historical"},
    {"slug": "petra-jo", "continent": "Asia", "continent_ko": "아시아", "country": "Jordan", "country_ko": "요르단", "city": "Petra", "city_ko": "페트라", "search_query": "Petra Treasury ancient Nabataean historical"},
    {"slug": "angkor-kh", "continent": "Asia", "continent_ko": "아시아", "country": "Cambodia", "country_ko": "캄보디아", "city": "Angkor Wat", "city_ko": "앙코르 와트", "search_query": "Angkor Wat temple Cambodia historical"},
    {"slug": "kyoto-hist", "continent": "Asia", "continent_ko": "아시아", "country": "Japan", "country_ko": "일본", "city": "Kyoto", "city_ko": "교토", "search_query": "Kyoto Fushimi Inari shrine historical"},
    {"slug": "istanbul-hist", "continent": "Asia", "continent_ko": "아시아", "country": "Turkey", "country_ko": "튀르키예", "city": "Istanbul", "city_ko": "이스탄불", "search_query": "Hagia Sophia Blue Mosque Istanbul historical"},
    {"slug": "jerusalem-il", "continent": "Asia", "continent_ko": "아시아", "country": "Israel", "country_ko": "이스라엘", "city": "Jerusalem", "city_ko": "예루살렘", "search_query": "Jerusalem Old City historical"},
    {"slug": "machu-picchu-pe", "continent": "South America", "continent_ko": "남아메리카", "country": "Peru", "country_ko": "페루", "city": "Machu Picchu", "city_ko": "마추픽chu", "search_query": "Machu Picchu Inca ruins historical"},
    {"slug": "pompeii-it", "continent": "Europe", "continent_ko": "유럽", "country": "Italy", "country_ko": "이탈리아", "city": "Pompeii", "city_ko": "폼페이", "search_query": "Pompeii ruins Vesuvius historical"},
    {"slug": "ephesus-tr", "continent": "Asia", "continent_ko": "아시아", "country": "Turkey", "country_ko": "튀르키예", "city": "Ephesus", "city_ko": "에페소스", "search_query": "Ephesus ancient ruins Turkey historical"},
    {"slug": "tikal-gt", "continent": "North America", "continent_ko": "북아메리카", "country": "Guatemala", "country_ko": "과테말라", "city": "Tikal", "city_ko": "티칼", "search_query": "Tikal Mayan pyramid Guatemala historical"},
    {"slug": "versailles-fr", "continent": "Europe", "continent_ko": "유럽", "country": "France", "country_ko": "프랑스", "city": "Versailles", "city_ko": "베르사유", "search_query": "Palace of Versailles garden historical"},
    {"slug": "xian-cn", "continent": "Asia", "continent_ko": "아시아", "country": "China", "country_ko": "중국", "city": "Xi'an", "city_ko": "시안", "search_query": "Terracotta Army Xi'an historical"},
    {"slug": "stonehenge-uk", "continent": "Europe", "continent_ko": "유럽", "country": "United Kingdom", "country_ko": "영국", "city": "Stonehenge", "city_ko": "스톤헨지", "search_query": "Stonehenge ancient monument historical"},
    {"slug": "chichen-itza-mx", "continent": "North America", "continent_ko": "북아메리카", "country": "Mexico", "country_ko": "멕시코", "city": "Chichen Itza", "city_ko": "치ichen 이tza", "search_query": "Chichen Itza Mayan pyramid Mexico historical"},
    {"slug": "hampi-in", "continent": "Asia", "continent_ko": "아시아", "country": "India", "country_ko": "인도", "city": "Hampi", "city_ko": "함피", "search_query": "Hampi ruins India historical"},
    {"slug": "luxor-eg", "continent": "Africa", "continent_ko": "아프리카", "country": "Egypt", "country_ko": "이집트", "city": "Luxor", "city_ko": "룩소르", "search_query": "Luxor Karnak temple Egypt historical"},
]

NATURE_PLACES: list[dict[str, str]] = [
    {"slug": "banff-ca", "continent": "North America", "continent_ko": "북아메리카", "country": "Canada", "country_ko": "캐나다", "city": "Banff", "city_ko": "밴프", "search_query": "Banff Lake Louise mountains nature"},
    {"slug": "yosemite-us", "continent": "North America", "continent_ko": "북아메리카", "country": "United States", "country_ko": "미국", "city": "Yosemite", "city_ko": "요세미티", "search_query": "Yosemite valley El Capitan nature"},
    {"slug": "milford-nz", "continent": "Oceania", "continent_ko": "오세아니아", "country": "New Zealand", "country_ko": "뉴질랜드", "city": "Milford Sound", "city_ko": "밀포드 사운드", "search_query": "Milford Sound fjord New Zealand nature"},
    {"slug": "geiranger-no", "continent": "Europe", "continent_ko": "유럽", "country": "Norway", "country_ko": "노르웨이", "city": "Geirangerfjord", "city_ko": "가이랑에르 피오르", "search_query": "Geirangerfjord Norway fjord nature"},
    {"slug": "iguazu-ar", "continent": "South America", "continent_ko": "남아메리카", "country": "Argentina", "country_ko": "아르헨티나", "city": "Iguazu Falls", "city_ko": "이과수 폭포", "search_query": "Iguazu Falls waterfall nature"},
    {"slug": "grand-canyon-us", "continent": "North America", "continent_ko": "북아메리카", "country": "United States", "country_ko": "미국", "city": "Grand Canyon", "city_ko": "그랜드 캐년", "search_query": "Grand Canyon Arizona nature landscape"},
    {"slug": "amazon-br", "continent": "South America", "continent_ko": "남아메리카", "country": "Brazil", "country_ko": "브라질", "city": "Amazon", "city_ko": "아마존", "search_query": "Amazon rainforest river nature"},
    {"slug": "jungfrau-ch", "continent": "Europe", "continent_ko": "유럽", "country": "Switzerland", "country_ko": "스위스", "city": "Jungfrau", "city_ko": "융프라우", "search_query": "Swiss Alps Jungfrau snow mountains nature"},
    {"slug": "plitvice-hr", "continent": "Europe", "continent_ko": "유럽", "country": "Croatia", "country_ko": "크로아티아", "city": "Plitvice", "city_ko": "플리트비체", "search_query": "Plitvice Lakes waterfalls Croatia nature"},
    {"slug": "halong-vn", "continent": "Asia", "continent_ko": "아시아", "country": "Vietnam", "country_ko": "베트남", "city": "Ha Long Bay", "city_ko": "하롱베이", "search_query": "Ha Long Bay limestone karst nature"},
    {"slug": "yellowstone-us", "continent": "North America", "continent_ko": "북아메리카", "country": "United States", "country_ko": "미국", "city": "Yellowstone", "city_ko": "옐로스톤", "search_query": "Yellowstone geyser nature landscape"},
    {"slug": "torres-cl", "continent": "South America", "continent_ko": "남아메리카", "country": "Chile", "country_ko": "칠레", "city": "Torres del Paine", "city_ko": "토레스 del 파이네", "search_query": "Torres del Paine Patagonia mountains nature"},
    {"slug": "serengeti-nature", "continent": "Africa", "continent_ko": "아프리카", "country": "Tanzania", "country_ko": "탄자니아", "city": "Serengeti", "city_ko": "세렝게티", "search_query": "Serengeti savanna wildlife nature landscape"},
    {"slug": "fuji-jp", "continent": "Asia", "continent_ko": "아시아", "country": "Japan", "country_ko": "일본", "city": "Mount Fuji", "city_ko": "후지산", "search_query": "Mount Fuji lake reflection nature"},
    {"slug": "baikal-ru", "continent": "Asia", "continent_ko": "아시아", "country": "Russia", "country_ko": "러시아", "city": "Lake Baikal", "city_ko": "바이칼 호", "search_query": "Lake Baikal ice winter nature"},
    {"slug": "jiuzhaigou-cn", "continent": "Asia", "continent_ko": "아시아", "country": "China", "country_ko": "중국", "city": "Jiuzhaigou", "city_ko": "구채구", "search_query": "Jiuzhaigou colorful lakes nature China"},
    {"slug": "kruger-za", "continent": "Africa", "continent_ko": "아프리카", "country": "South Africa", "country_ko": "남아프리카", "city": "Kruger", "city_ko": "크루거", "search_query": "Kruger National Park safari nature"},
    {"slug": "dolomites-it", "continent": "Europe", "continent_ko": "유럽", "country": "Italy", "country_ko": "이탈리아", "city": "Dolomites", "city_ko": "돌로미테", "search_query": "Dolomites Italy alpine mountains nature"},
]

TOUR_CATEGORIES: list[dict[str, Any]] = [
    {"id": "hot", "title": "Trending / Hot Place", "title_ko": "Hot Place", "pool": HOT_PLACES},
    {"id": "unique", "title": "Unique Destinations", "title_ko": "이색 여행지", "pool": UNIQUE_PLACES},
    {"id": "resort", "title": "Resort & Relaxation", "title_ko": "휴양 여행지", "pool": RESORT_PLACES},
    {"id": "historical", "title": "Historical Sites", "title_ko": "역사적 여행지", "pool": HISTORICAL_PLACES},
    {"id": "nature", "title": "Natural Wonders", "title_ko": "자연경관 우수", "pool": NATURE_PLACES},
]


def kst_today() -> date:
    return datetime.now(KST).date()


def _seed_for_date(d: date, salt: str = "") -> int:
    base = int(d.strftime("%Y%m%d"))
    if salt:
        base += sum(ord(ch) for ch in salt) * 17
    return base


def pick_places_from_pool(
    pool: list[dict[str, str]],
    d: date | None = None,
    *,
    n: int = 5,
    salt: str = "",
    exclude_slugs: set[str] | None = None,
) -> list[dict[str, str]]:
    """Pick n places with continent diversity using date-seeded shuffle."""
    target = d or kst_today()
    rng = random.Random(_seed_for_date(target, salt))
    blocked = set(exclude_slugs or ())

    available = [p for p in pool if p["slug"] not in blocked]
    if len(available) < n:
        available = list(pool)

    by_continent: dict[str, list[dict[str, str]]] = {}
    for place in available:
        by_continent.setdefault(place["continent"], []).append(place)

    for bucket in by_continent.values():
        rng.shuffle(bucket)

    picked: list[dict[str, str]] = []
    used_slugs: set[str] = set()

    for continent in CONTINENT_ORDER:
        if len(picked) >= n:
            break
        bucket = by_continent.get(continent) or []
        while bucket:
            place = bucket.pop(0)
            if place["slug"] in used_slugs:
                continue
            picked.append(dict(place))
            used_slugs.add(place["slug"])
            break

    remaining = [p for p in available if p["slug"] not in used_slugs]
    rng.shuffle(remaining)
    for place in remaining:
        if len(picked) >= n:
            break
        picked.append(dict(place))
        used_slugs.add(place["slug"])

    return picked[:n]


def pick_all_categories_for_date(d: date | None = None, n: int = 5) -> list[dict[str, Any]]:
    """Pick places for every tour category; avoid duplicate slugs across categories."""
    target = d or kst_today()
    used_slugs: set[str] = set()
    out: list[dict[str, Any]] = []

    for cat in TOUR_CATEGORIES:
        places = pick_places_from_pool(
            cat["pool"],
            target,
            n=n,
            salt=cat["id"],
            exclude_slugs=used_slugs,
        )
        for place in places:
            used_slugs.add(place["slug"])
        out.append(
            {
                "id": cat["id"],
                "title": cat["title"],
                "title_ko": cat["title_ko"],
                "places": places,
            }
        )
    return out


def pick_places_for_date(d: date | None = None, n: int = 5) -> list[dict[str, str]]:
    """Backward-compatible hot-place picker."""
    return pick_places_from_pool(HOT_PLACES, d, n=n, salt="hot")


def place_meta(place: dict[str, str]) -> dict[str, Any]:
    return {
        "slug": place["slug"],
        "continent": place["continent"],
        "continent_ko": place["continent_ko"],
        "country": place["country"],
        "country_ko": place["country_ko"],
        "city": place["city"],
        "city_ko": place["city_ko"],
    }
