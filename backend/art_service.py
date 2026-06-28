"""Metropolitan Museum of Art API integration for the ART page."""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

from deep_translator import GoogleTranslator

MET_BASE = "https://collectionapi.metmuseum.org/public/collection/v1"
MET_UA = "DigitalWorld-ART/1.0 (educational; github.com/Jongkyung-Ko/First)"

_CACHE: dict[str, tuple[float, Any]] = {}
_CACHE_TTL = 3600
_KO_CACHE: dict[str, str] = {}

GENRES: list[dict[str, str]] = [
    {
        "id": "history",
        "label": "역사화",
        "label_en": "History Painting",
        "search": "history mythology biblical",
        "hint": "역사·신화·종교적 장면을 그린 회화",
    },
    {
        "id": "portrait",
        "label": "초상화",
        "label_en": "Portrait",
        "search": "portrait",
        "hint": "인물의 얼굴과 성격을 담은 회화",
    },
    {
        "id": "landscape",
        "label": "풍경화",
        "label_en": "Landscape",
        "search": "landscape",
        "hint": "자연과 풍경을 주제로 한 회화",
    },
    {
        "id": "genre",
        "label": "풍속화",
        "label_en": "Genre Painting",
        "search": "genre everyday life",
        "hint": "일상과 풍속을 담은 회화",
    },
    {
        "id": "still_life",
        "label": "정물화",
        "label_en": "Still Life",
        "search": "still life",
        "hint": "정물·꽃·과일 등을 배치한 회화",
    },
]

ERAS: list[dict[str, Any]] = [
    {
        "id": "renaissance",
        "label": "르네상스",
        "period": "15–16세기",
        "artists": [
            "Leonardo da Vinci",
            "Michelangelo",
            "Raphael",
            "Titian",
            "Sandro Botticelli",
        ],
    },
    {
        "id": "baroque",
        "label": "바로크",
        "period": "17세기",
        "artists": [
            "Rembrandt",
            "Caravaggio",
            "Peter Paul Rubens",
            "Diego Velázquez",
            "Artemisia Gentileschi",
        ],
    },
    {
        "id": "rococo",
        "label": "로코코",
        "period": "18세기 초",
        "artists": [
            "Jean-Antoine Watteau",
            "François Boucher",
            "Jean-Honoré Fragonard",
            "Giovanni Battista Tiepolo",
            "Canaletto",
        ],
    },
    {
        "id": "romanticism",
        "label": "낭만주의",
        "period": "18–19세기",
        "artists": [
            "Eugène Delacroix",
            "Francisco Goya",
            "J.M.W. Turner",
            "John Constable",
            "Jacques-Louis David",
        ],
    },
    {
        "id": "impressionism",
        "label": "인상주의",
        "period": "19세기 후반",
        "artists": [
            "Claude Monet",
            "Edgar Degas",
            "Pierre-Auguste Renoir",
            "Camille Pissarro",
            "Mary Cassatt",
        ],
    },
    {
        "id": "modern",
        "label": "근대·현대",
        "period": "19–20세기",
        "artists": [
            "Vincent van Gogh",
            "Paul Cézanne",
            "Paul Gauguin",
            "Henri Matisse",
            "Pablo Picasso",
        ],
    },
]

_IMAGE_BYTES_CACHE: dict[str, tuple[float, bytes, str]] = {}
_IMAGE_BYTES_TTL = 86400

ARTIST_WIKI: dict[str, str] = {
    "Leonardo da Vinci": "Leonardo da Vinci - Presumed self-portrait - WGA12798.jpg",
    "Michelangelo": "Michelangelo Buonarroti by Daniele da Volterra.jpg",
    "Raphael": "Raffaello Sanzio.jpg",
    "Titian": "Titian Selfportrait.jpg",
    "Sandro Botticelli": "Sandro Botticelli 083.jpg",
    "Rembrandt": "Rembrandt Harmensz. van Rijn 063.jpg",
    "Rembrandt van Rijn": "Rembrandt Harmensz. van Rijn 063.jpg",
    "Caravaggio": "Caravaggio.jpg",
    "Peter Paul Rubens": "Peter Paul Rubens Self-portrait circa 1620.jpg",
    "Diego Velázquez": "Diego Velazquez.jpg",
    "Artemisia Gentileschi": "Artemisia Gentileschi - Self-Portrait as the Allegory of Painting.jpg",
    "Jean-Antoine Watteau": "Antoine Watteau by Rosalba Carriera.jpg",
    "François Boucher": "François Boucher by Gustav Lundberg.jpg",
    "Jean-Honoré Fragonard": "Jean-Honoré Fragonard.jpg",
    "Giovanni Battista Tiepolo": "Giovanni Battista Tiepolo by Alexandre Roslin.jpg",
    "Canaletto": "Canaletto.jpg",
    "Eugène Delacroix": "Eugène Delacroix 1837.jpg",
    "Francisco Goya": "Goya - Portrait of Francisco Bayeu.jpg",
    "J.M.W. Turner": "J.M.W. Turner.jpg",
    "John Constable": "John Constable by Daniel Gardner.jpg",
    "Jacques-Louis David": "Jacques-Louis David - selfportrait.jpg",
    "Claude Monet": "Claude Monet 1899 Nadar crop.jpg",
    "Edgar Degas": "Edgar Degas self portrait 1855.jpeg",
    "Pierre-Auguste Renoir": "Pierre-Auguste Renoir.jpg",
    "Camille Pissarro": "Camille Pissarro.jpg",
    "Mary Cassatt": "Mary Cassatt Self Portrait c1878.jpg",
    "Vincent van Gogh": "Vincent van Gogh - Self-Portrait - Google Art Project (454045).jpg",
    "Paul Cézanne": "Paul Cézanne.jpg",
    "Paul Gauguin": "Paul Gauguin 1891.png",
    "Henri Matisse": "Henri Matisse, 1913, photograph by Alvin Langdon Coburn.jpg",
    "Pablo Picasso": "Pablo picasso.jpg",
}

ARTIST_INFO: dict[str, dict[str, str]] = {
    "Leonardo da Vinci": {
        "life": "1452–1519 · 이탈리아",
        "description": "르네상스 전기를 대표하는 화가·조각가·발명가·과학자입니다. 피렌체와 밀라노, 프랑스 궁정을 오가며 인체 해부·원근법·자연 관찰을 회화에 결합했습니다. 경계가 흐려지는 명암법(스푸마토)과 피라미드형 구도로 인물의 심리를 섬세하게 그렸습니다. 《모나리자》《최후의 만찬》《비트루비우스적 인체 비례》 등이 대표작이며, 관찰과 상상을 동시에 추구한 ‘르네상스 인간’의 상징으로 평가받습니다.",
    },
    "Michelangelo": {
        "life": "1475–1564 · 이탈리아",
        "description": "조각·회화·건축·시에 모두 뛰어난 르네상스의 거장입니다. 인체의 근육과 비틀린 자세(테르지바트)로 긴장감과 영웅성을 표현했으며, 대리석 조각 《다비드》《피에타》로도 유명합니다. 로마 바티칸 시스티나 예배당 천장화 《천지창조》와 《최후의 심판》은 인체의 웅장함과 종교적 극적 힘의 정점으로 꼽힙니다. 피렌체·로마 미술의 중심에서 후대 바로크 이전 회화의 기준을 세웠습니다.",
    },
    "Raphael": {
        "life": "1483–1520 · 이탈리아",
        "description": "우아한 색감과 안정된 구도로 르네상스 회화의 이상적 조화를 보여준 화가입니다. 브루넬레스키·레오나르도·미켈란젤로의 성과를 종합해 인물 배치와 원근이 완벽하게 맞아떨어지는 화면을 완성했습니다. 바티칸 《아테네 학당》은 철학자들의 공간을 웅장하면서도 평온하게 구성한 걸작입니다. 짧은 생애에도 불구하고 후대 아카데미 회화의 모범이 되었습니다.",
    },
    "Titian": {
        "life": "c. 1488–1576 · 이탈리아(베네치아)",
        "description": "베네치아 화파의 대표 화가로, 색채와 붓터치의 자유로움으로 유명합니다. 초기에는 고운 명암을, 후기에는 더 느슨하고 울려 퍼지는 색면으로 인물의 심리와 분위기를 표현했습니다. 신화·종교·초상화를 막론하고 붓질 하나로 공기와 살결을 표현하는 능력이 뛰어났습니다. 벨라스케스 등 스페인·유럽 전역의 화가들에게 큰 영향을 주었습니다.",
    },
    "Sandro Botticelli": {
        "life": "c. 1445–1510 · 이탈리아(피렌체)",
        "description": "메디치 가문 후원 아래 활동한 피렌체 르네상스 초기의 화가입니다. 섬세한 윤곽선과 꿈결 같은 색으로 그리스·로마 신화와 종교를 그렸습니다. 《비너스의 탄생》《봄의 알레고리》는 바람에 날리는 옷감과 꽃잎의 장식성으로 사랑받습니다. 고전 재현과 고딕적 서정이 섞인 독특한 분위기가 특징입니다.",
    },
    "Rembrandt": {
        "life": "1606–1669 · 네덜란드",
        "description": "네덜란드 황금시대 최고의 화가·판화가입니다. 강한 명암 대비(키아로스쿠로)로 인물의 내면과 드라마를 포착했으며, 수백 점의 자화상으로 자신의 일생을 기록했습니다. 《밤의 순찰》은 단순한 집단 초상을 넘어 빛이 인물을 조명하는 연극적 장면입니다. 후기작일수록 붓질이 거칠어지지만 정서는 더 깊어지는 화가로 평가됩니다.",
    },
    "Caravaggio": {
        "life": "1571–1610 · 이탈리아",
        "description": "바로크 회화의 선구자로, 극적인 빛과 그림자(테네브리즘)로 유명합니다. 성경의 장면을 당대 이탈리아 거리·주점처럼 현실적으로 배치해 관람자에게 강한 몰입감을 줍니다. 《성 마태오의 소명》《두꺼비를 잡는 미노타우로스》 등에서 인물의 순간적 동작이 생생합니다. 짧고 격정적인 생애에도 불구하고 유럽 전역의 화가들에게 결정적 영향을 미쳤습니다.",
    },
    "Peter Paul Rubens": {
        "life": "1577–1640 · 플랑드르",
        "description": "플랑드르 바로크를 대표하는 화가이자 외교관입니다. 역동적인 대각선 구도, 풍만한 인체, 선명한 색으로 신화·역사·종교를 웅장하게 그렸습니다. 《사모손과 들릴라》《메두사 머리를 든 페르세우스》 등에서 움직임과 극적 장면이 특징입니다. 안트워프 공방을 운영하며 후학을 양성했고, 유럽 궁정 미술의 중심 인물이었습니다.",
    },
    "Diego Velázquez": {
        "life": "1599–1660 · 스페인",
        "description": "스페인 왕실 화가이자 바로크의 거장입니다. 왕과 궁정 인물을 사실적으로 그리면서도 빛·공기·시선의 미묘함을 포착했습니다. 《시녀들(라스 메니나스)》은 화가와 모델, 거울 속 왕실의 시선이 교차하는 회화에 대한 회화로 유명합니다. 느슨한 붓질과 회색 톤의 섬세한 변화는 인상주의 이전에 빛을 탐구한 선구적 시도로 평가됩니다.",
    },
    "Artemisia Gentileschi": {
        "life": "1593–c. 1656 · 이탈리아",
        "description": "카라바조풍 명암을 계승한 바로크 시기의 여성 화가입니다. 성경 속 강인한 여성—유디트, 에스테르, 수산나—을 주인공으로 그리며 서사와 정서를 극적으로 표현했습니다. 《유디트와 홀로페르네스》는 결단의 순간을 생생하게 포착한 대표작입니다. 당대 여성 예술가로서 후대 페미니스트 미술사에서도 중요하게 재조명되고 있습니다.",
    },
    "Jean-Antoine Watteau": {
        "life": "1684–1721 · 프랑스",
        "description": "로코코의 선구자로, 귀족의 산책·연회·극장 뒤풀이를 그린 ‘샹 드리(fête galante)’ 장르를 개척했습니다. 잔잔한 색과 가벼운 붓질로 사랑과 유희의 순간을 몽환적으로 표현했습니다. 《시레르로 향하는 행렬》《가면 무도회》가 대표작입니다. 짧은 생애였지만 18세기 프랑스 회화의 분위기를 규정했습니다.",
    },
    "François Boucher": {
        "life": "1703–1770 · 프랑스",
        "description": "루이 XV 시대를 대표하는 로코코 화가입니다. 파스텔 톤과 장식적인 곡선으로 신화·풍속·초상을 우아하고 화려하게 그렸습니다. 부드러운 피부색과 비단 같은 질감 표현이 특징이며, 《디아나의 목욕》 등이 유명합니다. 궁정과 부르주아 사이의 취향을 동시에 만족시키는 화려한 장식미가 돋보입니다.",
    },
    "Jean-Honoré Fragonard": {
        "life": "1732–1806 · 프랑스",
        "description": "로코코 후기의 대표 화가로, 가벼운 붓질과 밝은 색으로 연애·유희·자연을 그렸습니다. 《그네를 타는 소녀》는 나뭇가지 사이로 스침하는 순간의 기쁨을 생동감 있게 담았습니다. 부쉐의 화려함보다 개인적이고 즉흥적인 터치가 강합니다. 프랑스 혁명 전후 회화의 전환기를 살아가며 낭만주의로 이어지는 감성을 보여줍니다.",
    },
    "Giovanni Battista Tiepolo": {
        "life": "1696–1770 · 이탈리아(베네치아)",
        "description": "18세기 이탈리아 최고의 천장화·대형 종교화 화가입니다. 밝은 하늘색과 구름 위에 떠 있는 인물 배치로 공간을 열어젖히는 환상적 구도가 특징입니다. 베네치아·빈·마드리드 궁전에서 대규모 장식화를 맡았습니다. 바로크의 웅장함과 로코코의 가벼움을 결합한 후기 베네치아 화파의 정수입니다.",
    },
    "Canaletto": {
        "life": "1697–1768 · 이탈리아(베네치아)",
        "description": "베네치아 풍경화(베데우타)의 대가입니다. 카메라 옵스큐라를 활용한 정밀한 원근과 맑은 빛으로 운하·광장·축제를 사실적으로 기록했습니다. 영국 귀족들의 그랜드 투어 기념품으로 큰 인기를 끌었습니다. 도시 풍경을 ‘관광 홍보’가 아닌 예술적 기록으로 승화시킨 선구자입니다.",
    },
    "Eugène Delacroix": {
        "life": "1798–1863 · 프랑스",
        "description": "프랑스 낭만주의의 핵심 화가입니다. 강렬한 색·역동적 구도·동방적 상상력으로 혁명·역사·문학을 그렸습니다. 《민중을 이끄는 자유의 여신》은 1830년 7월 혁명의 상징이 되었고, 《사르다나팔루스의 죽음》은 색채의 폭발로 유명합니다. 붓질의 에너지와 감정의 절정이 낭만주의 회화의 기준을 세웠습니다.",
    },
    "Francisco Goya": {
        "life": "1746–1828 · 스페인",
        "description": "스페인 근대 미술의 거장으로, 궁정 화가에서 비판적·환상적 화가로 변모했습니다. 초기에는 카푸스 산 루카스의 밝은 풍속화와 왕실 초상을 그렸으나, 전쟁·질병 이후 《5월 3일》과 《검은 그림》처럼 인간의 잔혹함과 공포를 담았습니다. 판화 연작 《전쟁의 재앙》은 사진 이전 시대의 강력한 전쟁 기록입니다.",
    },
    "J.M.W. Turner": {
        "life": "1775–1851 · 영국",
        "description": "영국 풍경화·해양화의 거장이자 빛과 대기를 탐구한 화가입니다. 안개·폭풍·증기선·노을을 색으로 용해시키듯 표현해 형태가 거의 사라지는 후기작에 이르렀습니다. 《전함 테메레르호》와 《비·증기·속도》는 산업 혁명과 자연의 장엄함을 동시에 담습니다. 모네 이전의 ‘빛의 화가’로 인상주의에 결정적 영향을 주었습니다.",
    },
    "John Constable": {
        "life": "1776–1837 · 영국",
        "description": "영국 시골 풍경을 사실적이고 서정적으로 그린 화가입니다. 고향 서식스의 하늘·수로·목초지를 반복해 그리며 구름 스케치로 기상 변화를 기록했습니다. 《건초마차》《세인트 폴 대성당에서 본 데드햄 밸리》가 대표작입니다. 야외 스케치와 자연 관찰을 중시해 후대 풍경화의 토대를 마련했습니다.",
    },
    "Jacques-Louis David": {
        "life": "1748–1825 · 프랑스",
        "description": "신고전주의의 대표 화가이자 프랑스 혁명·나폴레옹 시대의 기록자입니다. 명확한 윤곽·고대 로마식 구도·극적인 순간 포착으로 도덕과 공화의 이미지를 만들었습니다. 《호라티우스 형제의 맹세》《마라의 죽음》《나폴레옹의 알프스 넘기》가 유명합니다. 정치와 미술이 맞물린 근대 회화의 전환점입니다.",
    },
    "Claude Monet": {
        "life": "1840–1926 · 프랑스",
        "description": "인상주의의 대표 화가이자 운동의 이름을 딴 《인상, 해돋이》의 작가입니다. 같은 대상—루앙 대성당, 건초더미, 수련—을 시간·날씨·빛에 따라 반복해 그렸습니다. 《수련》 연작은 후기 인상주의의 정수로, 색이 형태를 대체하는 경험을 제공합니다. 지베르니 정원은 그의 실험실이자 오늘날까지 사랑받는 예술 공간입니다.",
    },
    "Edgar Degas": {
        "life": "1834–1917 · 프랑스",
        "description": "발레리나·경마·카페·목욕하는 여인을 그린 인상주의 화가입니다. 사진과 일본 우키요에에서 영감을 받아 비정형 구도·잘린 인물·움직임의 순간을 포착했습니다. 파스텔과 조각에서도 인체의 긴장과 피로를 날카롭게 관찰했습니다. ‘인상주의’에 속하지만 관찰자의 시선으로 현대 도시 생활을 기록한 점이 독특합니다.",
    },
    "Pierre-Auguste Renoir": {
        "life": "1841–1919 · 프랑스",
        "description": "따뜻한 색과 부드러운 붓터치로 인물·풍경·풍속을 그린 인상주의 화가입니다. 빛이 피부와 옷감에 스며드는 느낌을 섬세하게 표현했습니다. 《물랭 드 라 갈리트의 발레》《점심을 먹는 노동자들》은 야외의 즐거움과 공동체를 노래합니다. 후기에는 더 선명한 윤곽과 고전적 형태를 추구하기도 했습니다.",
    },
    "Camille Pissarro": {
        "life": "1830–1903 · 프랑스",
        "description": "인상주의의 기여자이자 후기 인상주의로 이어지는 다작 화가입니다. 농촌·시골·파리 거리를 꾸준히 그리며 색의 조화와 구조를 탐구했습니다. 세잔·고갱 등 후배를 격려한 멘토 역할도 했습니다. 《적목 효과, 퐁투아즈》 등에서 점묘법과 붓질 실험이 두드러집니다.",
    },
    "Mary Cassatt": {
        "life": "1844–1926 · 미국(프랑스 활동)",
        "description": "프랑스 인상주의에 참여한 미국 출신 화가입니다. 어머니와 아이, 여성의 일상·목욕·차 시간을 따뜻하고 섬세하게 그렸습니다. 일본 우키요에의 평면적 구도를 흡수해 현대적 공간감을 만들었습니다. 《차를 마시는 사람》 등에서 손짓과 시선의 친밀함이 특징입니다.",
    },
    "Vincent van Gogh": {
        "life": "1853–1890 · 네덜란드(프랑스 활동)",
        "description": "짧은 10년의 작품 활동으로 근대 미술사를 바꾼 화가입니다. 네덜란드 시기의 어두운 풍속화에서 프로방스의 강렬한 색·소용돌이치는 붓질로 전환했습니다. 《해바라기》《별이 빛나는 밤》《아를의 방》은 감정과 에너지가 캔버스 전체를 뒤흔듭니다. 생전에는 인정받지 못했으나 오늘날 가장 사랑받는 화가 중 한 명입니다.",
    },
    "Paul Cézanne": {
        "life": "1839–1906 · 프랑스",
        "description": "‘현대 회화의 아버지’로 불리는 화가입니다. 정물·풍경·인물을 원기둥·원뿔·구로 분석하듯 재구성해 형태와 공간의 질서를 탐구했습니다. 《생자수테 산》 연작과 《사과가 담긴 정물》은 색 면이 구조를 만드는 실험의 정점입니다. 인상주의를 넘어 입체주의·추상화의 토대를 마련했습니다.",
    },
    "Paul Gauguin": {
        "life": "1848–1903 · 프랑스",
        "description": "증권 중개인에서 화가로 전향한 후 타히티·마르키즈 제도에서 열대의 삶을 그린 화가입니다. 서구 문명에 대한 이탈과 원시적·상징적 이미지를 추구했습니다. 《우리는 어디서 왔는가 우리는 누구인가 우리는 어디로 가는가》는 평면적 색면과 종교적 상징이 결합된 걸작입니다. 후기 인상주의에서 상징주의로 이어지는 다리 역할을 했습니다.",
    },
    "Henri Matisse": {
        "life": "1869–1954 · 프랑스",
        "description": "20세기 색채와 장식의 거장입니다. 야수파 이후 대담한 색면·단순화된 형태·유려한 선으로 인물·정물·종교를 그렸습니다. 《춤》《음악》은 색만으로 리듬과 기쁨을 전달합니다. 후기에는 종이 오리기(구텀부아)로도 혁신했으며, ‘예술은 편안한 의자’여야 한다는 신념으로 유명합니다.",
    },
    "Pablo Picasso": {
        "life": "1881–1973 · 스페인(프랑스 활동)",
        "description": "20세기 미술을 가장 많이 바꾼 화가·조각가입니다. 《아비뇽의 처녀들》로 입체주의를 열고, 형태를 해체·재조합하는 실험을 이어갔습니다. 《게르니카》는 스페인 내전의 참상을 흑백의 상징으로 승화한 반전·평화의 상징입니다. 회색·로즈·입체·신고전·초현실 등 끊임없는 화풍 변화로 ‘다작의 천재’로 기억됩니다.",
    },
}


def portrait_proxy_path(name: str, width: int | None = None) -> str:
    base = f"/api/art/portrait?name={urllib.parse.quote(name)}"
    if width:
        return f"{base}&w={width}"
    return base


def _cache_get(key: str) -> Any | None:
    entry = _CACHE.get(key)
    if not entry:
        return None
    expires, value = entry
    if time.time() > expires:
        _CACHE.pop(key, None)
        return None
    return value


def _cache_set(key: str, value: Any) -> Any:
    _CACHE[key] = (time.time() + _CACHE_TTL, value)
    return value


def _met_request(path: str, params: dict[str, Any] | None = None, *, retries: int = 4) -> Any:
    url = f"{MET_BASE}{path}"
    if params:
        clean = {k: v for k, v in params.items() if v is not None and v != ""}
        if clean:
            url = f"{url}?{urllib.parse.urlencode(clean)}"

    last_exc: urllib.error.HTTPError | None = None
    for attempt in range(retries):
        req = urllib.request.Request(url, headers={"User-Agent": MET_UA})
        try:
            with urllib.request.urlopen(req, timeout=45) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            last_exc = exc
            if exc.code in (403, 429, 503) and attempt < retries - 1:
                time.sleep(0.55 * (2**attempt))
                continue
            raise
    if last_exc:
        raise last_exc
    raise RuntimeError("Met request failed")


def _met_search(
    query: str,
    *,
    artist: bool = False,
    max_ids: int = 80,
) -> tuple[list[int], int]:
    cache_key = f"met-search:v1:{query.lower()}:artist={artist}"
    cached = _cache_get(cache_key)
    if cached is not None:
        ids, total = cached
        return list(ids[:max_ids]), total

    params: dict[str, Any] = {
        "q": query,
        "hasImages": "true",
        "isPublicDomain": "true",
    }
    if artist:
        params["artistOrCulture"] = "true"

    payload = _met_request("/search", params)
    ids = payload.get("objectIDs") or []
    total = int(payload.get("total") or 0)
    _cache_set(cache_key, (ids, total))
    return list(ids[:max_ids]), total


def _met_object(object_id: int) -> dict[str, Any] | None:
    cache_key = f"met-obj:{object_id}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached or None

    try:
        data = _met_request(f"/objects/{object_id}")
    except urllib.error.HTTPError as exc:
        if exc.code in (403, 404, 429):
            _cache_set(cache_key, {})
            return None
        raise

    if not data.get("objectID"):
        _cache_set(cache_key, {})
        return None
    return _cache_set(cache_key, data)


def _is_painting(obj: dict[str, Any]) -> bool:
    dept = (obj.get("department") or "").lower()
    if "painting" in dept:
        return True
    obj_name = (obj.get("objectName") or "").lower()
    if "painting" in obj_name:
        return True
    classification = str(obj.get("classification") or "").lower()
    return "painting" in classification


def _met_description(obj: dict[str, Any]) -> str:
    parts: list[str] = []
    for key in (
        "medium",
        "culture",
        "period",
        "department",
        "classification",
        "objectName",
    ):
        val = obj.get(key)
        if val and str(val).strip():
            parts.append(str(val).strip())
    bio = obj.get("artistDisplayBio")
    if bio and str(bio).strip():
        parts.append(str(bio).strip())
    dims = obj.get("dimensions")
    if dims:
        parts.append(str(dims).strip())
    credit = obj.get("creditLine")
    if credit:
        parts.append(str(credit).strip())
    if not parts:
        return "미술관 소장 공개 도메인 회화 작품"
    return " · ".join(parts)


def _translate_ko(text: str) -> str:
    clean = (text or "").strip()
    if not clean:
        return clean
    cached = _KO_CACHE.get(clean)
    if cached is not None:
        return cached
    try:
        payload = clean[:4500]
        translated = GoogleTranslator(source="auto", target="ko").translate(payload)
        result = (translated or clean).strip()
    except Exception:
        result = clean
    _KO_CACHE[clean] = result
    return result


def _apply_korean_descriptions(works: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not works:
        return works
    pending = {w["description"] for w in works if w.get("description")}
    if not pending:
        return works

    translated: dict[str, str] = {}
    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = {pool.submit(_translate_ko, text): text for text in pending}
        for future in as_completed(futures):
            original = futures[future]
            try:
                translated[original] = future.result()
            except Exception:
                translated[original] = original

    for work in works:
        desc = work.get("description")
        if desc and desc in translated:
            work["description"] = translated[desc]
    return works


def _met_image_urls(obj: dict[str, Any]) -> tuple[str, str, str] | None:
    thumb = (obj.get("primaryImageSmall") or "").strip()
    full = (obj.get("primaryImage") or thumb).strip()
    if not thumb and not full:
        return None
    if not thumb:
        thumb = full
    return thumb, thumb, full


def _normalize_met_object(obj: dict[str, Any]) -> dict[str, Any] | None:
    if not obj.get("isPublicDomain"):
        return None
    urls = _met_image_urls(obj)
    if not urls:
        return None
    preview, thumb, full = urls
    artist = (obj.get("artistDisplayName") or "").strip() or "Unknown Artist"
    return {
        "id": obj.get("objectID"),
        "title": obj.get("title") or "Untitled",
        "artist": artist,
        "date": obj.get("objectDate") or "",
        "description": _met_description(obj),
        "lqip": "",
        "preview_url": preview,
        "thumb_url": thumb,
        "image_url": full,
        "direct_preview_url": preview,
        "direct_thumb_url": thumb,
        "direct_image_url": full,
        "met_url": obj.get("objectURL") or "",
    }


def _fetch_met_works_from_ids(
    object_ids: list[int],
    limit: int = 20,
    *,
    paintings_only: bool = True,
) -> list[dict[str, Any]]:
    works: list[dict[str, Any]] = []
    seen: set[int] = set()
    for object_id in object_ids:
        if len(works) >= limit:
            break
        obj = _met_object(object_id)
        if not obj:
            continue
        if paintings_only and not _is_painting(obj):
            continue
        work = _normalize_met_object(obj)
        if not work or work["id"] in seen:
            continue
        seen.add(work["id"])
        works.append(work)
    return works


def _search_met_works(
    query: str,
    limit: int = 20,
    *,
    artist: bool = False,
) -> list[dict[str, Any]]:
    cache_key = f"met-works:v2:ko:{query.lower()}:a={artist}:n={limit}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    ids, _ = _met_search(query, artist=artist, max_ids=max(limit * 4, 40))
    works = _apply_korean_descriptions(_fetch_met_works_from_ids(ids, limit=limit))
    return _cache_set(cache_key, works)


def art_genres_list() -> list[dict[str, str]]:
    return GENRES


def fetch_genre_works(genre_id: str, limit: int = 20) -> dict[str, Any]:
    genre = next((g for g in GENRES if g["id"] == genre_id), None)
    if not genre:
        raise ValueError(f"Unknown genre: {genre_id}")
    works = _search_met_works(genre["search"], limit=limit)
    return {"genre": genre, "works": works, "count": len(works)}


def _artist_search_name(name: str) -> str:
    aliases = {
        "Rembrandt van Rijn": "Rembrandt",
        "Michelangelo": "Michelangelo Buonarroti",
    }
    return aliases.get(name, name)


def _artist_portrait(name: str) -> dict[str, str | None]:
    if name in ARTIST_WIKI or _artist_search_name(name) in ARTIST_WIKI:
        return {
            "preview_url": portrait_proxy_path(name, 120),
            "thumb_url": portrait_proxy_path(name, 200),
            "image_url": portrait_proxy_path(name, 320),
        }

    search_name = _artist_search_name(name)
    ids, _ = _met_search(search_name, artist=True, max_ids=6)
    for object_id in ids:
        obj = _met_object(object_id)
        if not obj:
            continue
        urls = _met_image_urls(obj)
        if not urls:
            continue
        preview, thumb, full = urls
        return {
            "preview_url": preview,
            "thumb_url": thumb,
            "image_url": full,
        }
    return {"preview_url": None, "thumb_url": None, "image_url": None}


def _artist_works(name: str, limit: int = 60) -> list[dict[str, Any]]:
    search_name = _artist_search_name(name)
    return _search_met_works(search_name, limit=limit, artist=True)


def _artist_sample_works(name: str, object_ids: list[int], limit: int = 3) -> list[dict[str, Any]]:
    if not object_ids:
        return []
    works = _apply_korean_descriptions(_fetch_met_works_from_ids(object_ids, limit=limit))
    return [
        {
            "id": w.get("id"),
            "title": w.get("title") or "Untitled",
            "date": w.get("date") or "",
            "thumb_url": w.get("thumb_url"),
            "image_url": w.get("image_url"),
            "direct_thumb_url": w.get("direct_thumb_url"),
            "direct_image_url": w.get("direct_image_url"),
        }
        for w in works[:limit]
    ]


def _artist_card(name: str, era: dict[str, Any]) -> dict[str, Any]:
    search_name = _artist_search_name(name)
    ids, total = _met_search(search_name, artist=True, max_ids=12)
    portrait = _artist_portrait(name)
    info = ARTIST_INFO.get(name) or ARTIST_INFO.get(search_name) or {}
    life = info.get("life", "")
    description = info.get("description") or f"{name}은(는) {era['label']} 시기를 대표하는 화가입니다."

    return {
        "name": name,
        "era_id": era["id"],
        "era_label": era["label"],
        "period": era.get("period") or "",
        "life": life,
        "description": description,
        "preview_url": portrait.get("preview_url"),
        "thumb_url": portrait.get("thumb_url"),
        "image_url": portrait.get("image_url"),
        "lqip": "",
        "sample_count": total,
        "sample_works": [],
    }


def fetch_artist_samples(name: str, limit: int = 3) -> dict[str, Any]:
    search_name = _artist_search_name(name)
    ids, _ = _met_search(search_name, artist=True, max_ids=12)
    return {
        "name": name,
        "sample_works": _artist_sample_works(name, ids, limit=limit),
    }


def fetch_eras_artists() -> list[dict[str, Any]]:
    cache_key = "eras:met:v4:ko"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    result: list[dict[str, Any]] = []
    for era in ERAS:
        artists = [_artist_card(name, era) for name in era["artists"]]
        result.append(
            {
                "id": era["id"],
                "label": era["label"],
                "period": era.get("period") or "",
                "artists": artists,
            }
        )
    return _cache_set(cache_key, result)


def fetch_artist_works(name: str, limit: int = 60) -> dict[str, Any]:
    works = _artist_works(name, limit=limit)
    portrait = _artist_portrait(name)
    search_name = _artist_search_name(name)
    return {
        "artist": {
            "name": name,
            "description": f"{name} — 대표 작품 감상.",
            "life": "",
            "preview_url": portrait.get("preview_url"),
            "thumb_url": portrait.get("thumb_url"),
            "image_url": portrait.get("image_url"),
            "lqip": "",
        },
        "works": works,
        "count": len(works),
    }


def _fetch_bytes(
    url: str,
    *,
    headers: dict[str, str] | None = None,
    timeout: int = 45,
    max_bytes: int = 800_000,
) -> tuple[bytes, str]:
    headers = headers or {"User-Agent": MET_UA}
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = resp.read(max_bytes)
        content_type = resp.headers.get("Content-Type", "image/jpeg")
    if not data:
        raise ValueError("Empty response")
    return data, content_type


def fetch_portrait_image(name: str, width: int = 320) -> tuple[bytes, str]:
    width = max(120, min(int(width), 640))
    cache_key = f"portrait:{name.lower()}:{width}"
    cached = _IMAGE_BYTES_CACHE.get(cache_key)
    if cached and cached[0] > time.time():
        return cached[1], cached[2]

    thumb_url = _resolve_portrait_thumb_url(name, width)
    if not thumb_url:
        raise ValueError("Portrait not found")

    data, content_type = _fetch_bytes(thumb_url)
    _IMAGE_BYTES_CACHE[cache_key] = (time.time() + _IMAGE_BYTES_TTL, data, content_type)
    return data, content_type


def _resolve_portrait_thumb_url(name: str, width: int) -> str | None:
    wiki_name = ARTIST_WIKI.get(name) or ARTIST_WIKI.get(_artist_search_name(name))
    if wiki_name:
        thumb = _wikimedia_thumb_url(wiki_name, width)
        if thumb:
            return thumb

    for query in (f"{name} portrait", f"{name} self-portrait", name):
        thumb = _wikimedia_search_thumb(query, width)
        if thumb:
            return thumb
    return None


def _wikimedia_search_thumb(query: str, width: int) -> str | None:
    cache_key = f"wiki-search:{query.lower()}:{width}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached or None

    api_url = (
        "https://commons.wikimedia.org/w/api.php?"
        + urllib.parse.urlencode(
            {
                "action": "query",
                "generator": "search",
                "gsrnamespace": "6",
                "gsrsearch": f'filetype:bitmap "{query}"',
                "gsrlimit": "8",
                "prop": "imageinfo",
                "iiprop": "url",
                "iiurlwidth": str(width),
                "format": "json",
            }
        )
    )
    req = urllib.request.Request(api_url, headers={"User-Agent": MET_UA})
    with urllib.request.urlopen(req, timeout=30) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    pages = payload.get("query", {}).get("pages", {})
    best: tuple[int, str] | None = None
    q = query.lower()
    for page in pages.values():
        if page.get("missing") is not None:
            continue
        title = (page.get("title") or "").lower()
        score = 0
        if "self-portrait" in title or "self portrait" in title:
            score += 4
        if "portrait" in title:
            score += 3
        for part in q.split():
            if len(part) > 2 and part in title:
                score += 2
        info = (page.get("imageinfo") or [{}])[0]
        thumb = info.get("thumburl") or info.get("url")
        if not thumb:
            continue
        if best is None or score > best[0]:
            best = (score, thumb)
    result = best[1] if best else ""
    _cache_set(cache_key, result)
    return result or None


def _wikimedia_thumb_url(filename: str, width: int) -> str | None:
    cache_key = f"wiki-thumb:{filename}:{width}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached or None

    title = filename if filename.startswith("File:") else f"File:{filename}"
    api_url = (
        "https://commons.wikimedia.org/w/api.php?"
        + urllib.parse.urlencode(
            {
                "action": "query",
                "titles": title,
                "prop": "imageinfo",
                "iiprop": "url",
                "iiurlwidth": str(width),
                "format": "json",
            }
        )
    )
    req = urllib.request.Request(api_url, headers={"User-Agent": MET_UA})
    with urllib.request.urlopen(req, timeout=30) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    pages = payload.get("query", {}).get("pages", {})
    for page in pages.values():
        if page.get("missing") is not None:
            continue
        info = (page.get("imageinfo") or [{}])[0]
        result = info.get("thumburl") or info.get("url")
        _cache_set(cache_key, result or "")
        return result
    _cache_set(cache_key, "")
    return None
