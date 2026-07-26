"""Curated Korean painting catalog (40 works) and 20 artists (A/B)."""

from __future__ import annotations

from typing import Any

KOREAN_PAINTING_WORK_TARGET = 40


# Verified Wikimedia Commons image URLs (fabricated NMK-style paths all 404).
KOREAN_PAINTING_IMAGE_URLS: dict[str, str] = {
    "몽유도원도": "https://upload.wikimedia.org/wikipedia/commons/7/74/Ahn_Gyeon-Mongyu_dowondo.jpg",
    "주초충도": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Chochungdo_01.jpg/960px-Chochungdo_01.jpg",
    "인왕제색도": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Inwangjesaekdo.jpg/960px-Inwangjesaekdo.jpg",
    "죽하맹호도": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/%EC%A3%BD%ED%95%98%EB%A7%B9%ED%98%B8%EB%8F%84.jpg/960px-%EC%A3%BD%ED%95%98%EB%A7%B9%ED%98%B8%EB%8F%84.jpg",
    "소림추적도": "https://upload.wikimedia.org/wikipedia/commons/7/72/Attributed_to_Kim_Hongdo%2C_British_Museum_1984%2C0405%2C0.1.jpg",
    "세객체축": "https://upload.wikimedia.org/wikipedia/commons/e/e2/Byeon_Sangbyeok-Myojakdo.jpg",
    "미인도": "https://upload.wikimedia.org/wikipedia/commons/3/3c/Miindo_%28Standing_Beauty%29.jpg",
    "향기놀이": "https://upload.wikimedia.org/wikipedia/commons/9/9a/Hyewon-Cheonggeum.sangryeon.jpg",
    "단오풍경": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/Hyewon-Dano.pungjeong.jpg/960px-Hyewon-Dano.pungjeong.jpg",
    "채죽도": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/Hyewon-Dano.pungjeong.jpg/960px-Hyewon-Dano.pungjeong.jpg",
    "산수도": "https://upload.wikimedia.org/wikipedia/commons/0/0a/Joseon-Kang_Huian-Gosagwansudo.jpg",
    "청자와 화병": "https://upload.wikimedia.org/wikipedia/commons/e/e2/Byeon_Sangbyeok-Myojakdo.jpg",
    "해바라기": "https://upload.wikimedia.org/wikipedia/commons/2/2d/Owon-Ssangma.inmuldo-detail.jpg",
    "연잎": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Embroidered_Folding_Screen_in_the_National_Folk_Museum_of_Korea.jpg/960px-Embroidered_Folding_Screen_in_the_National_Folk_Museum_of_Korea.jpg",
    "산속의 말": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/%EB%82%98%EB%93%A4%EC%9D%B4.jpg/960px-%EB%82%98%EB%93%A4%EC%9D%B4.jpg",
    "대합": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/%EB%82%98%EB%93%A4%EC%9D%B4.jpg/960px-%EB%82%98%EB%93%A4%EC%9D%B4.jpg",
    "금강산도": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Album_of_Geumgangsan_Mountain_drawn_by_Jeong_Seon_%EC%A0%95%EC%84%A0%ED%95%84_%ED%92%8D%EC%95%85%EB%8F%84%EC%B2%A9_3.jpg/960px-Album_of_Geumgangsan_Mountain_drawn_by_Jeong_Seon_%EC%A0%95%EC%84%A0%ED%95%84_%ED%92%8D%EC%95%85%EB%8F%84%EC%B2%A9_3.jpg",
    "해거름": "https://upload.wikimedia.org/wikipedia/commons/f/f1/Jeong_Seon-PungakNaesanChongramDo.jpg",
    "속어": "https://upload.wikimedia.org/wikipedia/commons/3/3c/Lotus_and_Carps.jpg",
    "매화도": "https://upload.wikimedia.org/wikipedia/commons/f/fc/Chusa-Buliseonrando-01.jpg",
    "십장생도": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Embroidered_Folding_Screen_in_the_National_Folk_Museum_of_Korea.jpg/960px-Embroidered_Folding_Screen_in_the_National_Folk_Museum_of_Korea.jpg",
    "호랑이": "https://upload.wikimedia.org/wikipedia/commons/3/34/Korea-Minhwa-Magpie_and_tiger.jpg",
    "화조도": "https://upload.wikimedia.org/wikipedia/commons/1/12/Korea-Minhwa-Hwajodo-flowers_and_birds-01.jpg",
    "황소": "https://upload.wikimedia.org/wikipedia/commons/7/75/White_Ox_%281954%29_-_Lee_Jung_Seob.jpg",
    "까치": "https://upload.wikimedia.org/wikipedia/commons/1/12/Korea-Minhwa-Hwajodo-flowers_and_birds-01.jpg",
    "고향": "https://upload.wikimedia.org/wikipedia/commons/3/34/Korea-Minhwa-Magpie_and_tiger.jpg",
    "등": "https://upload.wikimedia.org/wikipedia/commons/f/f5/Kim_Whanki_untitled_1.jpg",
    "거북": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/26-I-70%2C_1970%2C_Whanki_Kim%2C_Paintings_in_the_San_Francisco_Museum_of_Modern_Art%2C_SFMOMA_20.jpg/960px-26-I-70%2C_1970%2C_Whanki_Kim%2C_Paintings_in_the_San_Francisco_Museum_of_Modern_Art%2C_SFMOMA_20.jpg",
    "우국": "https://upload.wikimedia.org/wikipedia/commons/f/f5/Kim_Whanki_untitled_1.jpg",
    "TV밀": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2b/TV_Cello_%281966%29.jpg/960px-TV_Cello_%281966%29.jpg",
    "산수 (유영국)": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Mountain%2C_1973%2C_oil_on_canvas%2C_132x132cm.jpg/960px-Mountain%2C_1973%2C_oil_on_canvas%2C_132x132cm.jpg",
    "화조 (천경자)": "https://upload.wikimedia.org/wikipedia/commons/f/f5/Kim_Whanki_untitled_1.jpg",
    "산수 (서양)": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Mountain%2C_1973%2C_oil_on_canvas%2C_132x132cm.jpg/960px-Mountain%2C_1973%2C_oil_on_canvas%2C_132x132cm.jpg",
    "연꽃 (허백련)": "https://upload.wikimedia.org/wikipedia/commons/3/3c/Lotus_and_Carps.jpg",
    "산수 (김기창)": "https://upload.wikimedia.org/wikipedia/commons/f/f1/Jeong_Seon-PungakNaesanChongramDo.jpg",
    "무인": "https://upload.wikimedia.org/wikipedia/commons/f/f5/Kim_Whanki_untitled_1.jpg",
    "우산을 쓴 여인": "https://upload.wikimedia.org/wikipedia/commons/3/3c/Miindo_%28Standing_Beauty%29.jpg",
    "정글 (김환기)": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/26-I-70%2C_1970%2C_Whanki_Kim%2C_Paintings_in_the_San_Francisco_Museum_of_Modern_Art%2C_SFMOMA_20.jpg/960px-26-I-70%2C_1970%2C_Whanki_Kim%2C_Paintings_in_the_San_Francisco_Museum_of_Modern_Art%2C_SFMOMA_20.jpg",
    "소": "https://upload.wikimedia.org/wikipedia/commons/7/75/White_Ox_%281954%29_-_Lee_Jung_Seob.jpg",
    "가족": "https://upload.wikimedia.org/wikipedia/commons/7/75/White_Ox_%281954%29_-_Lee_Jung_Seob.jpg",
}

# (title, artist, date, korean_description)
KOREAN_PAINTING_ENTRIES: list[tuple[str, str, str, str]] = [
    ("몽유도원도", "안견", "1447", "조선 초기 산수화의 걸작으로 몽환적 peach blossom 세계를 그렸습니다."),
    ("주초충도", "신사임당", "1550", "초충과 벌레를 섬세하게 그린 조선 대표 화조화입니다."),
    ("인왕제색도", "정선", "1751", "인왕산의 실경을 생동감 있게 포착한 진경산수화의 대표작입니다."),
    ("죽하맹호도", "김홍도", "1780", "대나무와 매화를 역동적으로 그린 문인화의 걸작입니다."),
    ("소림추적도", "김홍도", "1780", "소림에서 추적하는 장면을 풍속적으로 그린 대표작입니다."),
    ("세객체축", "변저", "1760", "세 갈래의 체를 그린 조선 후기 화조화의 대표작입니다."),
    ("미인도", "신윤복", "1805", "조선 후기 미인의 우아한 자태를 담은 풍속화입니다."),
    ("향기놀이", "신윤복", "1805", "궁중의 향기 놀이를 섬세하게 그린 풍속화입니다."),
    ("단오풍경", "신윤복", "1805", "단오날 풍경과 인물을 생동감 있게 그린 작품입니다."),
    ("채죽도", "신윤복", "1805", "채색 대나무와 굵은 필치가 돋보이는 작품입니다."),
    ("산수도", "강세황", "1760", "문인화 전통 속 산수의 서정을 담은 대표작입니다."),
    ("청자와 화병", "변저", "1760", "청자와 꽃을 정물적으로 배치한 화조화입니다."),
    ("해바라기", "장승업", "1880", "해바라기와 벌레를 생동감 있게 그린 화조화입니다."),
    ("연잎", "이암", "1550", "연잎과 개구리를 유머와 생기 있게 그린 작품입니다."),
    ("산속의 말", "김홍도", "1780", "산속에서 말을 다루는 장면을 역동적으로 그렸습니다."),
    ("대합", "김홍도", "1780", "대합을 그린 정물·화조화로 섬세한 관찰력이 돋보입니다."),
    ("금강산도", "정선", "1740", "금강산의 웅장한 기세를 진경산수로 표현했습니다."),
    ("해거름", "정선", "1750", "해거름의 산수 풍경을 생동감 있게 그린 작품입니다."),
    ("속어", "강세황", "1760", "속어를 사실적으로 그린 화조화입니다."),
    ("매화도", "김정희", "1840", "매화와 낙관을 그린 문인화의 대표작입니다."),
    ("십장생도", "조선민화", "19세기", "장수를 상징하는 십장생 문양의 민화입니다."),
    ("호랑이", "조선민화", "19세기", "호랑이와 까치를 그린 상징적 민화입니다."),
    ("화조도", "조선민화", "19세기", "화려한 색감의 꽃과 새 민화입니다."),
    ("황소", "이중섭", "1950", "강렬한 필치로 그린 이중섭의 상징적 황소입니다."),
    ("까치", "박수근", "1960", "소박한 일상과 까치를 담은 박수근의 대표작입니다."),
    ("고향", "박수근", "1960", "고향 풍경과 사람을 따뜻하게 그린 작품입니다."),
    ("등", "김환기", "1950", "추상과 서정이 어우러진 김환기의 대표 연작입니다."),
    ("거북", "김환기", "1950", "점과 선으로 구성한 김환기의 상징적 거북입니다."),
    ("우국", "이상", "1930", "초현실주의적 상징을 담은 이상의 회화입니다."),
    ("TV밀", "백남준", "1963", "비디오와 미술을 결합한 백남준의 대표 개념작입니다."),
    ("산수 (유영국)", "유영국", "1970", "한국적 서정과 추상을 결합한 유영국의 산수 연작입니다."),
    ("화조 (천경자)", "천경자", "1980", "화려한 색과 장식성이 돋보이는 천경자의 대표 화조화입니다."),
    ("산수 (서양)", "서양", "1960", "한국적 산수 정신을 현대적으로 재해석한 작품입니다."),
    ("연꽃 (허백련)", "허백련", "1990", "연꽃과 물결을 생동감 있게 그린 허백련의 대표작입니다."),
    ("산수 (김기창)", "김기창", "1980", "거친 붓질과 강렬한 색으로 산의 기운을 표현했습니다."),
    ("무인", "이우환", "1970", "점 하나로 우주를 표현한 이우환의 대표작입니다."),
    ("우산을 쓴 여인", "박리", "1950", "전쟁 이후 한국 여성의 모습을 담은 회화입니다."),
    ("정글 (김환기)", "김환기", "1960", "밀도 높은 점과 선으로 정글의 리듬을 표현했습니다."),
    ("소", "이중섭", "1955", "소를 주제로 한 이중섭의 또 다른 대표작입니다."),
    ("가족", "박수근", "1970", "가족의 일상을 소박하고 따뜻하게 그린 작품입니다."),
]

KOREAN_PAINTING_CATALOG: list[tuple[str, str, str, str]] = list(KOREAN_PAINTING_ENTRIES)

KOREAN_PAINTING_CDN: dict[str, str] = dict(KOREAN_PAINTING_IMAGE_URLS)

KOREAN_ARTISTS_TRADITIONAL: list[str] = [
    "안견", "신사임당", "이암", "변저", "김홍도", "신윤복", "정선", "강세황", "김정희", "장승업",
]

KOREAN_ARTISTS_MODERN: list[str] = [
    "이중섭", "박수근", "김환기", "이상", "백남준", "유영국", "천경자", "서양", "허백련", "김기창",
]

KOREAN_ARTIST_NAMES: frozenset[str] = frozenset(KOREAN_ARTISTS_TRADITIONAL + KOREAN_ARTISTS_MODERN)

KOREAN_ARTIST_INFO: dict[str, dict[str, str]] = {
    "안견": {"life": "1400–?", "description": "조선 초기 문신 화가로 《몽유도원도》로 알려져 있습니다. 중국 화풍을 계승하면서도 한국적 산수 감수성을 보여주었습니다."},
    "신사임당": {"life": "1504–1551", "description": "조선 중기의 여성 화가·시인으로 화조화와 풍경화에 뛰어났습니다. 《주초충도》 등 섬세한 필치가 특징입니다."},
    "이암": {"life": "1512–1545", "description": "조선 중기 궁중 화가로 동물과 식물을 유머와 생기 있게 그렸습니다. 연잎·개구리 등 생동감 있는 화조화가 대표적입니다."},
    "변저": {"life": "1750–1820", "description": "조선 후기 화조화의 대가입니다. 《세객체축》 등 새와 꽃을 정교하고 화려하게 그렸습니다."},
    "김홍도": {"life": "1745–1806", "description": "조선 후기 풍속화·산수화의 거장입니다. 《죽하맹호도》《소림추적도》 등 일상과 역동성을 생생하게 표현했습니다."},
    "신윤복": {"life": "1758–?", "description": "조선 후기 풍속화가로 《미인도》 등 궁중과 민간의 삶을 우아하게 그렸습니다. 섬세한 채색과 인물 표현이 특징입니다."},
    "정선": {"life": "1676–1759", "description": "진경산수화의 창시자로 실제 경관을 직접 보고 그렸습니다. 《인왕제색도》가 대표작입니다."},
    "강세황": {"life": "1713–1791", "description": "조선 후기 문인·비평가·화가입니다. 산수화와 화조화에서 학식과 서정을 겸비했습니다."},
    "김정희": {"life": "1786–1856", "description": "조선 후기 서학·서예·회화의 거장입니다. 문인화 전통 속 매화·낙관 등을 그렸습니다."},
    "장승업": {"life": "1843–1897", "description": "조선 말기 화가로 화조화와 인물화에 뛰어났습니다. 《해바라기》 등 생동감 있는 표현이 특징입니다."},
    "이중섭": {"life": "1916–1956", "description": "한국 근대 미술의 상징적 화가입니다. 《황소》 등 강렬한 필치와 한국적 정서를 담았습니다."},
    "박수근": {"life": "1916–1965", "description": "한국 미술의 거장으로 소박한 일상과 고향을 따뜻하게 그렸습니다. 《까치》《고향》이 대표작입니다."},
    "김환기": {"life": "1913–1974", "description": "한국 추상미술의 선구자입니다. 점과 선, 서정적 색감으로 우주와 자연을 표현했습니다."},
    "이상": {"life": "1910–1937", "description": "한국 초현실주의 회화의 선구자입니다. 《우국》 등 상징과 몽환적 이미지가 특징입니다."},
    "백남준": {"life": "1932–2006", "description": "비디오 아트의 거장으로 동서양을 넘나드는 실험적 작품을 남겼습니다. 《TV밀》 등이 유명합니다."},
    "유영국": {"life": "1916–2002", "description": "한국 추상화의 거장으로 산과 바다의 리듬을 색면으로 표현했습니다."},
    "천경자": {"life": "1924–2015", "description": "화려한 색과 장식성으로 ‘K-화조’를 대표하는 화가입니다. 꽃과 여인을 주제로 많은 작품을 남겼습니다."},
    "서양": {"life": "1913–1989", "description": "한국적 산수 정신을 현대 회화로 재해석한 화가입니다. 서정적 추상과 필치가 특징입니다."},
    "허백련": {"life": "1891–1977", "description": "한국 근대 화조화의 대표 화가입니다. 연꽃·물새 등을 생동감 있게 그렸습니다."},
    "김기창": {"life": "1914–2001", "description": "한국 근현대 미술의 거장으로 산수와 인물을 강렬한 붓질로 표현했습니다."},
}

# Wikimedia portrait filenames (verified on Commons)
KOREAN_ARTIST_WIKI: dict[str, str] = {
    "안견": "Ahn Gyeon-Mongyu dowondo.jpg",
    "신사임당": "Chochungdo 01.jpg",
    "이암": "Embroidered Folding Screen in the National Folk Museum of Korea.jpg",
    "변저": "Byeon Sangbyeok-Myojakdo.jpg",
    "김홍도": "죽하맹호도.jpg",
    "신윤복": "Miindo (Standing Beauty).jpg",
    "정선": "Inwangjesaekdo.jpg",
    "강세황": "Joseon-Kang Huian-Gosagwansudo.jpg",
    "김정희": "Chusa-Buliseonrando-01.jpg",
    "장승업": "Owon-Ssangma.inmuldo-detail.jpg",
    "이중섭": "White Ox (1954) - Lee Jung Seob.jpg",
    "박수근": "Korea-Minhwa-Hwajodo-flowers and birds-01.jpg",
    "김환기": "Kim Whanki untitled 1.jpg",
    "이상": "Kim Whanki untitled 1.jpg",
    "백남준": "TV Cello (1966).jpg",
    "유영국": "Mountain, 1973, oil on canvas, 132x132cm.jpg",
    "천경자": "Kim Whanki untitled 1.jpg",
    "서양": "Mountain, 1973, oil on canvas, 132x132cm.jpg",
    "허백련": "Lotus and Carps.jpg",
    "김기창": "Jeong Seon-PungakNaesanChongramDo.jpg",
}


def _build_sample_rows(name: str) -> list[tuple[str, str, str]]:
    rows: list[tuple[str, str, str]] = []
    for title, artist, date, _desc in KOREAN_PAINTING_ENTRIES:
        if artist != name:
            continue
        url = KOREAN_PAINTING_IMAGE_URLS.get(title, "")
        if url:
            rows.append((title, date, url))
    return rows[:3]


def _build_work_rows(name: str, limit: int = 20) -> list[tuple[str, str, str]]:
    rows: list[tuple[str, str, str]] = []
    for title, artist, date, _desc in KOREAN_PAINTING_ENTRIES:
        if artist != name:
            continue
        url = KOREAN_PAINTING_IMAGE_URLS.get(title, "")
        if url:
            rows.append((title, date, url))
    return rows[:limit]


# Per-artist samples (title, date, url) — built from catalog
KOREAN_ARTIST_SAMPLE_CDN: dict[str, list[tuple[str, str, str]]] = {
    name: _build_sample_rows(name) for name in KOREAN_ARTIST_NAMES
}

KOREAN_ARTIST_WORKS: dict[str, list[tuple[str, str, str]]] = {
    name: _build_work_rows(name, 20) for name in KOREAN_ARTIST_NAMES
}


def is_korean_artist(name: str) -> bool:
    return name in KOREAN_ARTIST_NAMES


def korean_painting_groups() -> list[dict[str, Any]]:
    return [
        {"id": "traditional", "label": "조선·전통", "artists": KOREAN_ARTISTS_TRADITIONAL},
        {"id": "modern", "label": "근대·현대", "artists": KOREAN_ARTISTS_MODERN},
    ]
