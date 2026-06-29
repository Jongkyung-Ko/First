"""Metropolitan Museum of Art API integration for the ART page."""

from __future__ import annotations

import json
import random
import re
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Any

from deep_translator import GoogleTranslator

MET_BASE = "https://collectionapi.metmuseum.org/public/collection/v1"
MET_UA = "DigitalWorld-ART/1.0 (educational; github.com/Jongkyung-Ko/First)"

_CACHE: dict[str, tuple[float, Any]] = {}
_CACHE_TTL = 3600
_KO_CACHE: dict[str, str] = {}

GENRES: list[dict[str, str]] = [
    {
        "id": "masterpiece",
        "label": "명작",
        "label_en": "Masterpieces",
        "search": "",
        "hint": "세계에서 가장 유명한 그림 40선",
    },
    {
        "id": "history",
        "label": "역사화",
        "label_en": "History Painting",
        "search": "mythology biblical religious narrative painting",
        "hint": "역사·신화·종교적 장면을 그린 회화",
    },
    {
        "id": "portrait",
        "label": "초상화",
        "label_en": "Portrait",
        "search": "portrait self-portrait painting",
        "hint": "인물의 얼굴과 성격을 담은 회화",
    },
    {
        "id": "landscape",
        "label": "풍경화",
        "label_en": "Landscape",
        "search": "landscape view painting",
        "hint": "자연과 풍경을 주제로 한 회화",
    },
    {
        "id": "genre",
        "label": "풍속화",
        "label_en": "Genre Painting",
        "search": "genre everyday domestic interior painting",
        "hint": "일상과 풍속을 담은 회화",
    },
    {
        "id": "still_life",
        "label": "정물화",
        "label_en": "Still Life",
        "search": "still life flowers fruit painting",
        "hint": "정물·꽃·과일 등을 배치한 회화",
    },
]

MASTERPIECE_CATALOG: list[tuple[str, str, str, str]] = [
    ("Mona Lisa", "Leonardo da Vinci", "c. 1503-1506", "르네상스 초상화의 정점으로 가장 널리 알려진 작품입니다."),
    ("The Last Supper", "Leonardo da Vinci", "1495-1498", "예수와 12제자의 극적인 순간을 담은 벽화입니다."),
    ("The Starry Night", "Vincent van Gogh", "1889", "소용돌이치는 밤하늘로 후기 인상주의를 상징합니다."),
    ("The Scream", "Edvard Munch", "1893", "불안과 공포의 정서를 강렬하게 표현한 대표작입니다."),
    ("Guernica", "Pablo Picasso", "1937", "전쟁의 비극을 고발하는 20세기 반전의 상징입니다."),
    ("The Birth of Venus", "Sandro Botticelli", "c. 1484-1486", "르네상스 신화화의 대표작입니다."),
    ("The Creation of Adam", "Michelangelo", "c. 1511-1512", "시스티나 천장화의 상징 장면입니다."),
    ("The Persistence of Memory", "Salvador Dali", "1931", "녹아내리는 시계로 초현실주의를 대표합니다."),
    ("Girl with a Pearl Earring", "Johannes Vermeer", "c. 1665", "빛과 시선이 돋보이는 바로크 명작입니다."),
    ("The Night Watch", "Rembrandt", "1642", "집단 초상을 극적 장면으로 바꾼 작품입니다."),
    ("Las Meninas", "Diego Velazquez", "1656", "시선과 공간을 복합적으로 다룬 걸작입니다."),
    ("American Gothic", "Grant Wood", "1930", "미국 지역주의 미술의 상징적 초상화입니다."),
    ("The Kiss", "Gustav Klimt", "1907-1908", "금박 장식과 상징성이 돋보이는 작품입니다."),
    ("Liberty Leading the People", "Eugene Delacroix", "1830", "혁명의 열기를 담은 낭만주의 대표작입니다."),
    ("The School of Athens", "Raphael", "1509-1511", "르네상스 인문주의를 집약한 프레스코화입니다."),
    ("A Sunday Afternoon on the Island of La Grande Jatte", "Georges Seurat", "1884-1886", "점묘법을 대표하는 대작입니다."),
    ("Water Lilies", "Claude Monet", "1914-1926", "빛과 색의 변화를 극대화한 연작입니다."),
    ("The Great Wave off Kanagawa", "Katsushika Hokusai", "c. 1831", "우키요에를 세계적으로 알린 판화입니다."),
    ("Whistler's Mother", "James McNeill Whistler", "1871", "절제된 구성의 상징적 초상화입니다."),
    ("The Arnolfini Portrait", "Jan van Eyck", "1434", "상징이 풍부한 북유럽 르네상스 걸작입니다."),
    ("The Garden of Earthly Delights", "Hieronymus Bosch", "c. 1490-1510", "환상적 상징 세계를 보여주는 삼면화입니다."),
    ("Nighthawks", "Edward Hopper", "1942", "도시의 고독을 상징하는 현대 회화입니다."),
    ("The Hay Wain", "John Constable", "1821", "영국 풍경화의 대표작입니다."),
    ("Impression, Sunrise", "Claude Monet", "1872", "인상주의의 이름을 남긴 작품입니다."),
    ("The Gleaners", "Jean-Francois Millet", "1857", "농민의 삶을 사실적으로 그린 현실주의 대표작입니다."),
    ("The Third of May 1808", "Francisco Goya", "1814", "전쟁의 폭력을 고발한 역사화 걸작입니다."),
    ("The Son of Man", "Rene Magritte", "1964", "초현실주의의 상징적 이미지로 유명합니다."),
    ("The Sleeping Gypsy", "Henri Rousseau", "1897", "몽환적 원시주의 분위기의 대표작입니다."),
    ("Cafe Terrace at Night", "Vincent van Gogh", "1888", "강렬한 색채 대비가 인상적인 야경입니다."),
    ("Dance at Le Moulin de la Galette", "Pierre-Auguste Renoir", "1876", "인상주의의 활기와 빛을 담은 명작입니다."),
    ("The Card Players", "Paul Cezanne", "c. 1890-1895", "구조적 색면으로 근대 회화에 큰 영향을 준 작품입니다."),
    ("Bal du moulin de la Galette", "Pierre-Auguste Renoir", "1876", "파리의 삶을 생생하게 기록한 대표작입니다."),
    ("Olympia", "Edouard Manet", "1863", "근대 미술의 전환점으로 평가받는 작품입니다."),
    ("Luncheon of the Boating Party", "Pierre-Auguste Renoir", "1881", "인물과 빛의 조화가 뛰어난 인상주의 명작입니다."),
    ("No. 5, 1948", "Jackson Pollock", "1948", "추상표현주의 드리핑 기법의 대표작입니다."),
    ("Campbell's Soup Cans", "Andy Warhol", "1962", "팝아트의 상징적 연작입니다."),
    ("Arrangement in Grey and Black No.1", "James McNeill Whistler", "1871", "일명 휘슬러의 어머니로 알려진 작품입니다."),
    ("Christina's World", "Andrew Wyeth", "1948", "미국 사실주의의 상징적 장면입니다."),
    ("Saturn Devouring His Son", "Francisco Goya", "c. 1819-1823", "어둡고 강렬한 표현으로 유명한 작품입니다."),
    ("The Swing", "Jean-Honore Fragonard", "1767", "로코코의 화려함과 경쾌함을 보여주는 대표작입니다."),
]

_MASTERPIECE_DESC: dict[str, str] = {title: desc for title, _, _, desc in MASTERPIECE_CATALOG}

MASTERPIECE_CDN: dict[str, str] = {
    "Mona Lisa": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Mona_Lisa%2C_by_Leonardo_da_Vinci%2C_from_C2RMF_retouched.jpg/960px-Mona_Lisa%2C_by_Leonardo_da_Vinci%2C_from_C2RMF_retouched.jpg",
    "The Last Supper": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/The_Last_Supper_-_Leonardo_Da_Vinci_-_High_Resolution_32x16.jpg/960px-The_Last_Supper_-_Leonardo_Da_Vinci_-_High_Resolution_32x16.jpg",
    "The Starry Night": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg/960px-Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg",
    "The Scream": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Edvard_Munch%2C_1893%2C_The_Scream%2C_oil%2C_tempera_and_pastel_on_cardboard%2C_91_x_73_cm%2C_National_Gallery_of_Norway.jpg/960px-Edvard_Munch%2C_1893%2C_The_Scream%2C_oil%2C_tempera_and_pastel_on_cardboard%2C_91_x_73_cm%2C_National_Gallery_of_Norway.jpg",
    "Guernica": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Guernica.jpg/960px-Guernica.jpg",
    "The Birth of Venus": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Sandro_Botticelli_-_La_nascita_di_Venere_-_Google_Art_Project_-_edited.jpg/960px-Sandro_Botticelli_-_La_nascita_di_Venere_-_Google_Art_Project_-_edited.jpg",
    "The Creation of Adam": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Michelangelo_-_Creation_of_Adam_%28cropped%29.jpg/960px-Michelangelo_-_Creation_of_Adam_%28cropped%29.jpg",
    "The Persistence of Memory": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/Dargenta_%26_Salvador_Dali_The_persistance_of_Memory.png/960px-Dargenta_%26_Salvador_Dali_The_persistance_of_Memory.png",
    "Girl with a Pearl Earring": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/1665_Girl_with_a_Pearl_Earring.jpg/960px-1665_Girl_with_a_Pearl_Earring.jpg",
    "The Night Watch": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/La_ronda_de_noche%2C_por_Rembrandt_van_Rijn.jpg/960px-La_ronda_de_noche%2C_por_Rembrandt_van_Rijn.jpg",
    "Las Meninas": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Las_Meninas%2C_by_Diego_Vel%C3%A1zquez%2C_from_Prado_in_Google_Earth.jpg/960px-Las_Meninas%2C_by_Diego_Vel%C3%A1zquez%2C_from_Prado_in_Google_Earth.jpg",
    "American Gothic": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/Grant_Wood_-_American_Gothic_-_Google_Art_Project.jpg/960px-Grant_Wood_-_American_Gothic_-_Google_Art_Project.jpg",
    "The Kiss": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/The_Kiss_-_Gustav_Klimt_-_Google_Cultural_Institute.jpg/960px-The_Kiss_-_Gustav_Klimt_-_Google_Cultural_Institute.jpg",
    "Liberty Leading the People": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/La_Libert%C3%A9_guidant_le_peuple_-_Eug%C3%A8ne_Delacroix_-_Mus%C3%A9e_du_Louvre_Peintures_RF_129_-_apr%C3%A8s_restauration_2024.jpg/960px-La_Libert%C3%A9_guidant_le_peuple_-_Eug%C3%A8ne_Delacroix_-_Mus%C3%A9e_du_Louvre_Peintures_RF_129_-_apr%C3%A8s_restauration_2024.jpg",
    "The School of Athens": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/%22The_School_of_Athens%22_by_Raffaello_Sanzio_da_Urbino.jpg/960px-%22The_School_of_Athens%22_by_Raffaello_Sanzio_da_Urbino.jpg",
    "A Sunday Afternoon on the Island of La Grande Jatte": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/A_Sunday_on_La_Grande_Jatte%2C_Georges_Seurat%2C_1884.jpg/960px-A_Sunday_on_La_Grande_Jatte%2C_Georges_Seurat%2C_1884.jpg",
    "Water Lilies": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Claude_Monet_-_Water_Lilies_-_Google_Art_Project.jpg/960px-Claude_Monet_-_Water_Lilies_-_Google_Art_Project.jpg",
    "The Great Wave off Kanagawa": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Tsunami_by_hokusai_19th_century.jpg/960px-Tsunami_by_hokusai_19th_century.jpg",
    "Whistler's Mother": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Whistlers_Mother_high_res.jpg/960px-Whistlers_Mother_high_res.jpg",
    "Arrangement in Grey and Black No.1": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Whistlers_Mother_high_res.jpg/960px-Whistlers_Mother_high_res.jpg",
    "The Arnolfini Portrait": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/Van_Eyck_-_Arnolfini_Portrait.jpg/960px-Van_Eyck_-_Arnolfini_Portrait.jpg",
    "The Garden of Earthly Delights": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/The_Garden_of_earthly_delights.jpg/960px-The_Garden_of_earthly_delights.jpg",
    "Nighthawks": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Nighthawks_by_Edward_Hopper_1942.jpg/960px-Nighthawks_by_Edward_Hopper_1942.jpg",
    "The Hay Wain": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/John_Constable_-_The_Hay_Wain_%281821%29.jpg/960px-John_Constable_-_The_Hay_Wain_%281821%29.jpg",
    "Impression, Sunrise": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/59/Monet_-_Impression%2C_Sunrise.jpg/960px-Monet_-_Impression%2C_Sunrise.jpg",
    "The Gleaners": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Jean-Fran%C3%A7ois_Millet_-_Gleaners_-_Google_Art_Project_2.jpg/960px-Jean-Fran%C3%A7ois_Millet_-_Gleaners_-_Google_Art_Project_2.jpg",
    "The Third of May 1808": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/El_Tres_de_Mayo%2C_by_Francisco_de_Goya%2C_from_Prado_thin_black_margin.jpg/960px-El_Tres_de_Mayo%2C_by_Francisco_de_Goya%2C_from_Prado_thin_black_margin.jpg",
    "The Sleeping Gypsy": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/La_Boh%C3%A9mienne_endormie.jpg/960px-La_Boh%C3%A9mienne_endormie.jpg",
    "Cafe Terrace at Night": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Vincent-van-gogh-cafe-terrace-on-the-place-du-forum-arles-at-night-the.jpg/960px-Vincent-van-gogh-cafe-terrace-on-the-place-du-forum-arles-at-night-the.jpg",
    "Dance at Le Moulin de la Galette": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Renoir%2C_Pierre-Auguste_-_Dance_at_Le_Moulin_de_la_Galette%2C_1876.jpg/960px-Renoir%2C_Pierre-Auguste_-_Dance_at_Le_Moulin_de_la_Galette%2C_1876.jpg",
    "Bal du moulin de la Galette": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Renoir%2C_Pierre-Auguste_-_Dance_at_Le_Moulin_de_la_Galette%2C_1876.jpg/960px-Renoir%2C_Pierre-Auguste_-_Dance_at_Le_Moulin_de_la_Galette%2C_1876.jpg",
    "The Card Players": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Les_Joueurs_de_cartes%2C_par_Paul_C%C3%A9zanne.jpg/960px-Les_Joueurs_de_cartes%2C_par_Paul_C%C3%A9zanne.jpg",
    "Olympia": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Edouard_Manet_-_Olympia_-_Google_Art_ProjectFXD.jpg/960px-Edouard_Manet_-_Olympia_-_Google_Art_ProjectFXD.jpg",
    "Luncheon of the Boating Party": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Pierre-Auguste_Renoir_-_Luncheon_of_the_Boating_Party_-_Google_Art_Project.jpg/960px-Pierre-Auguste_Renoir_-_Luncheon_of_the_Boating_Party_-_Google_Art_Project.jpg",
    "Campbell's Soup Cans": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Campbell%27s_Soup_Cans_by_Andy_Warhol.jpg/960px-Campbell%27s_Soup_Cans_by_Andy_Warhol.jpg",
    "Saturn Devouring His Son": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Francisco_de_Goya%2C_Saturno_devorando_a_su_hijo_%281819-1823%29.jpg/960px-Francisco_de_Goya%2C_Saturno_devorando_a_su_hijo_%281819-1823%29.jpg",
    "The Swing": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/The_Swing_%28P430%29.jpg/960px-The_Swing_%28P430%29.jpg",
    "The Son of Man": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Noun_project_-_The_Son_of_Man_-_in_frame_colored.png/960px-Noun_project_-_The_Son_of_Man_-_in_frame_colored.png",
}

MASTERPIECE_CACHE_VERSION = "cdn-v2"

# 화가 카드 대표작 — Met/AIC 403 시 Wikimedia CDN 폴백 (브라우저에서 직접 로드 가능)
ARTIST_SAMPLE_CDN: dict[str, list[tuple[str, str, str]]] = {
    "Leonardo da Vinci": [
        ("Mona Lisa", "c. 1503", MASTERPIECE_CDN["Mona Lisa"]),
        ("The Last Supper", "c. 1495", MASTERPIECE_CDN["The Last Supper"]),
        (
            "Vitruvian Man",
            "c. 1490",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Da_Vinci_Vitruve_Luc_Viatour.jpg/960px-Da_Vinci_Vitruve_Luc_Viatour.jpg",
        ),
    ],
    "Michelangelo": [
        ("The Creation of Adam", "c. 1512", MASTERPIECE_CDN["The Creation of Adam"]),
        (
            "David",
            "1504",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Michelangelo%27s_David_-_right_view_2.jpg/960px-Michelangelo%27s_David_-_right_view_2.jpg",
        ),
        (
            "Pietà",
            "1499",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Michelangelo%27s_Pieta_5450_cropncleaned.jpg/960px-Michelangelo%27s_Pieta_5450_cropncleaned.jpg",
        ),
    ],
    "Raphael": [
        ("The School of Athens", "1509–1511", MASTERPIECE_CDN["The School of Athens"]),
        (
            "Sistine Madonna",
            "1512",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/Sistine_Madonna.jpg/960px-Sistine_Madonna.jpg",
        ),
        (
            "The Marriage of the Virgin",
            "1504",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/Raffaello_-_Spozalizio_-_Web_Gallery_of_Art.jpg/960px-Raffaello_-_Spozalizio_-_Web_Gallery_of_Art.jpg",
        ),
    ],
    "Titian": [
        (
            "Venus of Urbino",
            "1538",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Titian_-_Venus_of_Urbino_-_Google_Art_Project.jpg/960px-Titian_-_Venus_of_Urbino_-_Google_Art_Project.jpg",
        ),
        (
            "Bacchus and Ariadne",
            "1523",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/Titian_Bacchus_and_Ariadne.jpg/960px-Titian_Bacchus_and_Ariadne.jpg",
        ),
        (
            "Assumption of the Virgin",
            "1516–1518",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Titian_-_Assumption_of_the_Virgin_-_Google_Art_Project.jpg/960px-Titian_-_Assumption_of_the_Virgin_-_Google_Art_Project.jpg",
        ),
    ],
    "Sandro Botticelli": [
        ("The Birth of Venus", "c. 1485", MASTERPIECE_CDN["The Birth of Venus"]),
        (
            "Primavera",
            "c. 1482",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Botticelli-primavera.jpg/960px-Botticelli-primavera.jpg",
        ),
        (
            "Adoration of the Magi",
            "1475",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Sandro_Botticelli_-_Adorazione_dei_Magi_-_Google_Art_Project.jpg/960px-Sandro_Botticelli_-_Adorazione_dei_Magi_-_Google_Art_Project.jpg",
        ),
    ],
    "Rembrandt": [
        ("The Night Watch", "1642", MASTERPIECE_CDN["The Night Watch"]),
        (
            "The Anatomy Lesson of Dr. Nicolaes Tulp",
            "1632",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Rembrandt_Harmensz._van_Rijn_-_The_Anatomy_Lesson_of_Dr_Nicolaes_Tulp_-_Google_Art_Project.jpg/960px-Rembrandt_Harmensz._van_Rijn_-_The_Anatomy_Lesson_of_Dr_Nicolaes_Tulp_-_Google_Art_Project.jpg",
        ),
        (
            "The Jewish Bride",
            "c. 1667",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Rembrandt_-_The_Jewish_Bride_-_Google_Art_Project.jpg/960px-Rembrandt_-_The_Jewish_Bride_-_Google_Art_Project.jpg",
        ),
    ],
    "Caravaggio": [
        (
            "The Calling of Saint Matthew",
            "1599–1600",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Caravaggio_-_Calling_of_Saint_Matthew_-_Google_Art_ProjectFXD.jpg/960px-Caravaggio_-_Calling_of_Saint_Matthew_-_Google_Art_ProjectFXD.jpg",
        ),
        (
            "Bacchus",
            "c. 1596",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Caravaggio_-_Bacchus_-_Google_Art_Project.jpg/960px-Caravaggio_-_Bacchus_-_Google_Art_Project.jpg",
        ),
        (
            "Judith Beheading Holofernes",
            "c. 1599",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/Judith_beheading_Holofernes-Caravaggio_%28c.1598-9%29.jpg/960px-Judith_beheading_Holofernes-Caravaggio_%28c.1598-9%29.jpg",
        ),
    ],
    "Peter Paul Rubens": [
        (
            "Samson and Delilah",
            "c. 1609",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Peter_Paul_Rubens_-_Samson_and_Delilah_-_Google_Art_Project.jpg/960px-Peter_Paul_Rubens_-_Samson_and_Delilah_-_Google_Art_Project.jpg",
        ),
        (
            "The Descent from the Cross",
            "1612–1614",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Peter_Paul_Rubens_-_The_Descent_from_the_Cross_-_Google_Art_Project.jpg/960px-Peter_Paul_Rubens_-_The_Descent_from_the_Cross_-_Google_Art_Project.jpg",
        ),
        (
            "The Elevation of the Cross",
            "1610",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Peter_Paul_Rubens_-_The_Elevation_of_the_Cross_-_Google_Art_Project.jpg/960px-Peter_Paul_Rubens_-_The_Elevation_of_the_Cross_-_Google_Art_Project.jpg",
        ),
    ],
    "Diego Velázquez": [
        ("Las Meninas", "1656", MASTERPIECE_CDN["Las Meninas"]),
        (
            "Portrait of Pope Innocent X",
            "1650",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Portrait_of_Innocent_X.jpg/960px-Portrait_of_Innocent_X.jpg",
        ),
        (
            "The Surrender of Breda",
            "1634–1635",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Velazquez-The_Surrender_of_Breda.jpg/960px-Velazquez-The_Surrender_of_Breda.jpg",
        ),
    ],
    "Artemisia Gentileschi": [
        (
            "Judith Slaying Holofernes",
            "c. 1614–1620",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Artemisia_Gentileschi_-_Judith_beheading_Holofernes_-_Google_Art_Project.jpg/960px-Artemisia_Gentileschi_-_Judith_beheading_Holofernes_-_Google_Art_Project.jpg",
        ),
        (
            "Self-Portrait as the Allegory of Painting",
            "c. 1638–1639",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Artemisia_Gentileschi_-_Self-Portrait_as_the_Allegory_of_Painting_%28La_Pittura%29_-_Google_Art_Project.jpg/960px-Artemisia_Gentileschi_-_Self-Portrait_as_the_Allegory_of_Painting_%28La_Pittura%29_-_Google_Art_Project.jpg",
        ),
        (
            "Susanna and the Elders",
            "1610",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/Artemisia_Gentileschi_-_Susanna_and_the_Elders_-_Google_Art_Project.jpg/960px-Artemisia_Gentileschi_-_Susanna_and_the_Elders_-_Google_Art_Project.jpg",
        ),
    ],
    "Jean-Antoine Watteau": [
        (
            "Pilgrimage to Cythera",
            "1717",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Antoine_Watteau_-_Pilgrimage_to_Cythera_-_Google_Art_Project.jpg/960px-Antoine_Watteau_-_Pilgrimage_to_Cythera_-_Google_Art_Project.jpg",
        ),
        (
            "The Embarkation for Cythera",
            "1717",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Antoine_Watteau_-_Pilgrimage_to_Cythera_-_Google_Art_Project.jpg/960px-Antoine_Watteau_-_Pilgrimage_to_Cythera_-_Google_Art_Project.jpg",
        ),
        (
            "The Shop Sign of Gersaint",
            "1720",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Antoine_Watteau_-_L%27Enseigne_de_Gersaint_-_Google_Art_Project.jpg/960px-Antoine_Watteau_-_L%27Enseigne_de_Gersaint_-_Google_Art_Project.jpg",
        ),
    ],
    "François Boucher": [
        (
            "Diana Bathing",
            "1742",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Fran%C3%A7ois_Boucher_-_Diana_Bathing_-_Google_Art_Project.jpg/960px-Fran%C3%A7ois_Boucher_-_Diana_Bathing_-_Google_Art_Project.jpg",
        ),
        (
            "The Toilet of Venus",
            "1751",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Fran%C3%A7ois_Boucher_-_The_Toilet_of_Venus_-_Google_Art_Project.jpg/960px-Fran%C3%A7ois_Boucher_-_The_Toilet_of_Venus_-_Google_Art_Project.jpg",
        ),
        (
            "Madame de Pompadour",
            "1756",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Fran%C3%A7ois_Boucher_-_Madame_de_Pompadour_-_Google_Art_Project.jpg/960px-Fran%C3%A7ois_Boucher_-_Madame_de_Pompadour_-_Google_Art_Project.jpg",
        ),
    ],
    "Jean-Honoré Fragonard": [
        ("The Swing", "1767", MASTERPIECE_CDN["The Swing"]),
        (
            "The Stolen Kiss",
            "c. 1788",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Jean-Honor%C3%A9_Fragonard_-_The_Stolen_Kiss_-_Google_Art_Project.jpg/960px-Jean-Honor%C3%A9_Fragonard_-_The_Stolen_Kiss_-_Google_Art_Project.jpg",
        ),
        (
            "The Progress of Love",
            "1771–1773",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Jean-Honor%C3%A9_Fragonard_-_The_Meeting_-_Google_Art_Project.jpg/960px-Jean-Honor%C3%A9_Fragonard_-_The_Meeting_-_Google_Art_Project.jpg",
        ),
    ],
    "Giovanni Battista Tiepolo": [
        (
            "The Triumph of Bacchus and Ariadne",
            "1743–1745",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Giovanni_Battista_Tiepolo_-_The_Immortal_Continent_%28Bacchus_and_Ariadne%29_-_Google_Art_Project.jpg/960px-Giovanni_Battista_Tiepolo_-_The_Immortal_Continent_%28Bacchus_and_Ariadne%29_-_Google_Art_Project.jpg",
        ),
        (
            "The Banquet of Cleopatra",
            "1743–1744",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Giovanni_Battista_Tiepolo_-_The_Banquet_of_Cleopatra_-_Google_Art_Project.jpg/960px-Giovanni_Battista_Tiepolo_-_The_Banquet_of_Cleopatra_-_Google_Art_Project.jpg",
        ),
        (
            "The Martyrdom of Saint Agatha",
            "c. 1750",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Giovanni_Battista_Tiepolo_-_The_Martyrdom_of_Saint_Agatha_-_Google_Art_Project.jpg/960px-Giovanni_Battista_Tiepolo_-_The_Martyrdom_of_Saint_Agatha_-_Google_Art_Project.jpg",
        ),
    ],
    "Canaletto": [
        (
            "The Stonemason's Yard",
            "c. 1725",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/Canaletto_-_The_Stone_Mason%27s_Yard_-_Google_Art_Project.jpg/960px-Canaletto_-_The_Stone_Mason%27s_Yard_-_Google_Art_Project.jpg",
        ),
        (
            "The Grand Canal in Venice",
            "c. 1730",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Canaletto_-_The_Grand_Canal_in_Venice_from_Palazzo_Flabelli_to_Campo_San_Vio_-_Google_Art_Project.jpg/960px-Canaletto_-_The_Grand_Canal_in_Venice_from_Palazzo_Flabelli_to_Campo_San_Vio_-_Google_Art_Project.jpg",
        ),
        (
            "Venice: The Basin of San Marco",
            "1740",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Canaletto_-_Venice%2C_The_Basin_of_San_Marco_on_Ascension_Day_-_Google_Art_Project.jpg/960px-Canaletto_-_Venice%2C_The_Basin_of_San_Marco_on_Ascension_Day_-_Google_Art_Project.jpg",
        ),
    ],
    "Eugène Delacroix": [
        ("Liberty Leading the People", "1830", MASTERPIECE_CDN["Liberty Leading the People"]),
        (
            "The Death of Sardanapalus",
            "1827",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Eug%C3%A8ne_Delacroix_-_The_Death_of_Sardanapalus_-_Google_Art_Project.jpg/960px-Eug%C3%A8ne_Delacroix_-_The_Death_of_Sardanapalus_-_Google_Art_Project.jpg",
        ),
        (
            "Women of Algiers",
            "1834",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Eug%C3%A8ne_Delacroix_-_Women_of_Algiers_in_their_Apartments_-_Google_Art_Project.jpg/960px-Eug%C3%A8ne_Delacroix_-_Women_of_Algiers_in_their_Apartments_-_Google_Art_Project.jpg",
        ),
    ],
    "Francisco Goya": [
        ("The Third of May 1808", "1814", MASTERPIECE_CDN["The Third of May 1808"]),
        ("Saturn Devouring His Son", "c. 1819", MASTERPIECE_CDN["Saturn Devouring His Son"]),
        (
            "The Nude Maja",
            "c. 1800",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/Francisco_de_Goya_y_Lucientes_-_The_Nude_Maja_-_Google_Art_Project.jpg/960px-Francisco_de_Goya_y_Lucientes_-_The_Nude_Maja_-_Google_Art_Project.jpg",
        ),
    ],
    "J.M.W. Turner": [
        (
            "The Fighting Temeraire",
            "1839",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Turner_-_Fighting_Temeraire_%28Google_Art_Project%29.jpg/960px-Turner_-_Fighting_Temeraire_%28Google_Art_Project%29.jpg",
        ),
        (
            "Rain, Steam and Speed",
            "1844",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/JMW_Turner_-_Rain%2C_Steam_and_Speed_-_National_Gallery.jpg/960px-JMW_Turner_-_Rain%2C_Steam_and_Speed_-_National_Gallery.jpg",
        ),
        (
            "The Slave Ship",
            "1840",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/JMW_Turner_-_The_Slave_Ship_-_Google_Art_Project.jpg/960px-JMW_Turner_-_The_Slave_Ship_-_Google_Art_Project.jpg",
        ),
    ],
    "John Constable": [
        ("The Hay Wain", "1821", MASTERPIECE_CDN["The Hay Wain"]),
        (
            "The Cornfield",
            "1826",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/John_Constable_-_The_Cornfield_-_Google_Art_Project.jpg/960px-John_Constable_-_The_Cornfield_-_Google_Art_Project.jpg",
        ),
        (
            "Salisbury Cathedral from the Meadows",
            "1831",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/John_Constable_-_Salisbury_Cathedral_from_the_Meadows_-_Google_Art_Project.jpg/960px-John_Constable_-_Salisbury_Cathedral_from_the_Meadows_-_Google_Art_Project.jpg",
        ),
    ],
    "Jacques-Louis David": [
        (
            "The Death of Marat",
            "1793",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Death_of_Marat_by_David.jpg/960px-Death_of_Marat_by_David.jpg",
        ),
        (
            "Napoleon Crossing the Alps",
            "1801",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Jacques-Louis_David_-_The_Emperor_Napoleon_in_His_Study_at_the_Tuileries_-_Google_Art_Project.jpg/960px-Jacques-Louis_David_-_The_Emperor_Napoleon_in_His_Study_at_the_Tuileries_-_Google_Art_Project.jpg",
        ),
        (
            "The Oath of the Horatii",
            "1784",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Jacques-Louis_David%2C_Le_Serment_des_Horaces.jpg/960px-Jacques-Louis_David%2C_Le_Serment_des_Horaces.jpg",
        ),
    ],
    "Claude Monet": [
        ("Water Lilies", "1916", MASTERPIECE_CDN["Water Lilies"]),
        ("Impression, Sunrise", "1872", MASTERPIECE_CDN["Impression, Sunrise"]),
        (
            "Woman with a Parasol",
            "1875",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Claude_Monet_-_Woman_with_a_Parasol_-_Madame_Monet_and_Her_Son_-_Google_Art_Project.jpg/960px-Claude_Monet_-_Woman_with_a_Parasol_-_Madame_Monet_and_Her_Son_-_Google_Art_Project.jpg",
        ),
    ],
    "Edgar Degas": [
        (
            "The Ballet Class",
            "1874",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/Edgar_Degas_-_The_Ballet_Class_-_Google_Art_Project.jpg/960px-Edgar_Degas_-_The_Ballet_Class_-_Google_Art_Project.jpg",
        ),
        (
            "The Absinthe Drinker",
            "1876",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Edgar_Degas_-_In_a_Caf%C3%A9_%28The_Absinthe_Drinker%29_-_Google_Art_Project.jpg/960px-Edgar_Degas_-_In_a_Caf%C3%A9_%28The_Absinthe_Drinker%29_-_Google_Art_Project.jpg",
        ),
        (
            "Little Dancer of Fourteen Years",
            "c. 1881",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Edgar_Degas_-_Little_Dancer_of_Fourteen_Years_-_Google_Art_Project.jpg/960px-Edgar_Degas_-_Little_Dancer_of_Fourteen_Years_-_Google_Art_Project.jpg",
        ),
    ],
    "Pierre-Auguste Renoir": [
        ("Dance at Le Moulin de la Galette", "1876", MASTERPIECE_CDN["Dance at Le Moulin de la Galette"]),
        ("Luncheon of the Boating Party", "1881", MASTERPIECE_CDN["Luncheon of the Boating Party"]),
        (
            "Bal du moulin de la Galette",
            "1876",
            MASTERPIECE_CDN["Bal du moulin de la Galette"],
        ),
    ],
    "Camille Pissarro": [
        (
            "Boulevard Montmartre, Spring",
            "1897",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/5/59/Pissarro_-_Boulevard_Montmartre%2C_Spring.jpg/960px-Pissarro_-_Boulevard_Montmartre%2C_Spring.jpg",
        ),
        (
            "The Harvest",
            "1882",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Camille_Pissarro_-_The_Harvest_-_Google_Art_Project.jpg/960px-Camille_Pissarro_-_The_Harvest_-_Google_Art_Project.jpg",
        ),
        (
            "Red Roofs",
            "1877",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Camille_Pissarro_-_Red_Roofs%2C_Corner_of_a_Village%2C_Winter_-_Google_Art_Project.jpg/960px-Camille_Pissarro_-_Red_Roofs%2C_Corner_of_a_Village%2C_Winter_-_Google_Art_Project.jpg",
        ),
    ],
    "Mary Cassatt": [
        (
            "The Child's Bath",
            "1893",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Mary_Cassatt_-_The_Child%27s_Bath_-_Google_Art_Project.jpg/960px-Mary_Cassatt_-_The_Child%27s_Bath_-_Google_Art_Project.jpg",
        ),
        (
            "The Boating Party",
            "1893–1894",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Mary_Cassatt_-_The_Boating_Party_-_Google_Art_Project.jpg/960px-Mary_Cassatt_-_The_Boating_Party_-_Google_Art_Project.jpg",
        ),
        (
            "Little Girl in a Blue Armchair",
            "1878",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Mary_Cassatt_-_Little_Girl_in_a_Blue_Armchair_-_Google_Art_Project.jpg/960px-Mary_Cassatt_-_Little_Girl_in_a_Blue_Armchair_-_Google_Art_Project.jpg",
        ),
    ],
    "Vincent van Gogh": [
        ("The Starry Night", "1889", MASTERPIECE_CDN["The Starry Night"]),
        ("Cafe Terrace at Night", "1888", MASTERPIECE_CDN["Cafe Terrace at Night"]),
        (
            "Sunflowers",
            "1888",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Vincent_Willem_van_Gogh_127.jpg/960px-Vincent_Willem_van_Gogh_127.jpg",
        ),
    ],
    "Paul Cézanne": [
        ("The Card Players", "c. 1890", MASTERPIECE_CDN["The Card Players"]),
        (
            "Mont Sainte-Victoire",
            "1904",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/Paul_C%C3%A9zanne_-_Mont_Sainte-Victoire_-_Google_Art_Project.jpg/960px-Paul_C%C3%A9zanne_-_Mont_Sainte-Victoire_-_Google_Art_Project.jpg",
        ),
        (
            "The Basket of Apples",
            "c. 1893",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Paul_C%C3%A9zanne_-_The_Basket_of_Apples_-_Google_Art_Project.jpg/960px-Paul_C%C3%A9zanne_-_The_Basket_of_Apples_-_Google_Art_Project.jpg",
        ),
    ],
    "Paul Gauguin": [
        (
            "Where Do We Come From? What Are We? Where Are We Going?",
            "1897–1898",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Paul_Gauguin_-_Where_Do_We_Come_From%3F_What_Are_We%3F_Where_Are_We_Going%3F_-_Google_Art_Project.jpg/960px-Paul_Gauguin_-_Where_Do_We_Come_From%3F_What_Are_We%3F_Where_Are_We_Going%3F_-_Google_Art_Project.jpg",
        ),
        (
            "Vision After the Sermon",
            "1888",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Paul_Gauguin_-_Vision_After_the_Sermon_-_Google_Art_Project.jpg/960px-Paul_Gauguin_-_Vision_After_the_Sermon_-_Google_Art_Project.jpg",
        ),
        (
            "Spirit of the Dead Watching",
            "1892",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Paul_Gauguin_-_Manao_tupapau_%28The_Spirit_of_the_Dead_Keep_Watch%29_-_Google_Art_Project.jpg/960px-Paul_Gauguin_-_Manao_tupapau_%28The_Spirit_of_the_Dead_Keep_Watch%29_-_Google_Art_Project.jpg",
        ),
    ],
    "Henri Matisse": [
        (
            "Dance",
            "1909",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Henri_Matisse%2C_1909%2C_La_danse_%28The_Dance%29%2C_oil_on_canvas%2C_260_x_391_cm%2C_Museum_of_Modern_Art%2C_New_York.jpg/960px-Henri_Matisse%2C_1909%2C_La_danse_%28The_Dance%29%2C_oil_on_canvas%2C_260_x_391_cm%2C_Museum_of_Modern_Art%2C_New_York.jpg",
        ),
        (
            "The Red Room",
            "1908",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Henri_Matisse_-_Harmony_in_Red_-_Google_Art_Project.jpg/960px-Henri_Matisse_-_Harmony_in_Red_-_Google_Art_Project.jpg",
        ),
        (
            "Woman with a Hat",
            "1905",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Henri_Matisse_-_Woman_with_a_Hat_-_Google_Art_Project.jpg/960px-Henri_Matisse_-_Woman_with_a_Hat_-_Google_Art_Project.jpg",
        ),
    ],
    "Pablo Picasso": [
        ("Guernica", "1937", MASTERPIECE_CDN["Guernica"]),
        (
            "Les Demoiselles d'Avignon",
            "1907",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Les_Demoiselles_d%27Avignon%2C_by_Pablo_Picasso%2C_from_C2RMF.jpg/960px-Les_Demoiselles_d%27Avignon%2C_by_Pablo_Picasso%2C_from_C2RMF.jpg",
        ),
        (
            "The Old Guitarist",
            "1903–1904",
            "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Pablo_Picasso%2C_1903%2C_The_Old_Guitarist%2C_oil_on_panel%2C_122.9_x_82.6_cm%2C_Art_Institute_of_Chicago.jpg/960px-Pablo_Picasso%2C_1903%2C_The_Old_Guitarist%2C_oil_on_panel%2C_122.9_x_82.6_cm%2C_Art_Institute_of_Chicago.jpg",
        ),
    ],
}


_WIKIMEDIA_THUMB_WIDTHS = (250, 330, 500, 960, 1280, 1920)


def _wikimedia_snap_width(width: int) -> int:
    for w in _WIKIMEDIA_THUMB_WIDTHS:
        if w >= max(1, width):
            return w
    return _WIKIMEDIA_THUMB_WIDTHS[-1]


def _wikimedia_downsize(url: str, width: int = 330) -> str:
    if not url or "upload.wikimedia.org" not in url:
        return url
    if "/thumb/" not in url:
        return url
    snap = _wikimedia_snap_width(width)
    return re.sub(r"/\d+px-", f"/{snap}px-", url, count=1)


def _cdn_sample_work(name: str, idx: int, title: str, date: str, image_url: str) -> dict[str, Any]:
    thumb = _wikimedia_downsize(image_url, 330)
    preview = image_url
    full = image_url
    desc = _MASTERPIECE_DESC.get(title) or f"{name}의 대표 작품 《{title}》입니다."
    return {
        "id": f"cdn-sample:{name}:{idx}",
        "source": "cdn",
        "title": title,
        "artist": name,
        "date": date,
        "description": desc,
        "lqip": "",
        "thumb_url": thumb,
        "preview_url": preview,
        "image_url": full,
        "direct_thumb_url": thumb,
        "direct_preview_url": preview,
        "direct_image_url": full,
    }


def _artist_cdn_samples(name: str, limit: int = 3) -> list[dict[str, Any]]:
    rows = (
        ARTIST_SAMPLE_CDN.get(name)
        or ARTIST_SAMPLE_CDN.get(_artist_search_name(name))
        or []
    )
    return [
        _cdn_sample_work(name, idx, title, date, url)
        for idx, (title, date, url) in enumerate(rows[:limit])
    ]


def _wikimedia_upload_variants(base_url: str) -> tuple[str, str, str]:
    return base_url, base_url, base_url


def _apply_masterpiece_image_urls(work: dict[str, Any], title: str) -> dict[str, Any]:
    cdn = MASTERPIECE_CDN.get(title)
    if cdn:
        preview, thumb, full = _wikimedia_upload_variants(cdn)
        work["preview_url"] = preview
        work["thumb_url"] = thumb
        work["image_url"] = full
        work["direct_preview_url"] = preview
        work["direct_thumb_url"] = thumb
        work["direct_image_url"] = full
    return work


def is_masterpiece_genre(genre_id: str) -> bool:
    return genre_id == "masterpiece"


def _masterpiece_genre_meta() -> dict[str, str]:
    return next((g for g in GENRES if g["id"] == "masterpiece"), {
        "id": "masterpiece",
        "label": "명작",
        "label_en": "Masterpieces",
        "search": "",
        "hint": "세계에서 가장 유명한 그림 40선",
    })


def _masterpiece_base_work(
    idx: int,
    title: str,
    artist: str,
    date: str,
    desc: str,
) -> dict[str, Any]:
    return {
        "id": f"masterpiece-{idx:02d}",
        "title": title,
        "artist": artist,
        "date": date,
        "description": desc,
        "lqip": "",
        "preview_url": "",
        "thumb_url": "",
        "image_url": "",
        "direct_preview_url": "",
        "direct_thumb_url": "",
        "direct_image_url": "",
    }


def _overlay_masterpiece_images(
    base: dict[str, Any],
    resolved: dict[str, Any] | None,
) -> dict[str, Any]:
    if not resolved:
        return base
    out = dict(base)
    for key in (
        "preview_url",
        "thumb_url",
        "image_url",
        "direct_preview_url",
        "direct_thumb_url",
        "direct_image_url",
        "lqip",
        "met_url",
        "source",
        "image_id",
    ):
        val = resolved.get(key)
        if val:
            out[key] = val
    return out


def _title_matches_masterpiece(obj_title: str, want_title: str) -> bool:
    got = _normalize_title_key(obj_title)
    want = _normalize_title_key(want_title)
    if not got or not want:
        return False
    if got == want or _titles_likely_same(got, want):
        return True
    return want in got or got in want


def _search_met_masterpiece(title: str, artist: str) -> dict[str, Any] | None:
    search_name = _artist_search_name(artist)
    cache_key = f"met-masterpiece:v1:{title.lower()}:{artist.lower()}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached or None

    result: dict[str, Any] | None = None
    for query in (f'"{title}" {artist}', f"{title} {search_name}", f"{title} painting"):
        ids, _ = _met_search(query, artist=False, max_ids=20)
        for object_id in ids:
            obj = _met_object(object_id)
            if not obj or not obj.get("isPublicDomain"):
                continue
            if not _is_painting(obj):
                continue
            if not _title_matches_masterpiece(str(obj.get("title") or ""), title):
                continue
            display = str(obj.get("artistDisplayName") or "")
            if not _object_matches_artist(display, artist, search_name):
                continue
            result = _normalize_met_object(obj)
            if result:
                break
        if result:
            break

    _cache_set(cache_key, result or {})
    return result


def _wikimedia_masterpiece_urls(title: str, artist: str, *, search: bool = True) -> tuple[str, str, str] | None:
    cdn = MASTERPIECE_CDN.get(title)
    if cdn:
        return _wikimedia_upload_variants(cdn)

    if not search:
        return None

    best: tuple[int, str, str, str] | None = None
    for query in (f"{title} {artist} painting", f"{title} painting", title):
        thumb = _wikimedia_search_thumb(query, 400)
        if not thumb:
            continue
        preview = _wikimedia_search_thumb(query, 843) or thumb
        full = _wikimedia_search_thumb(query, 1400) or preview
        score = 0
        q = query.lower()
        blob = thumb.lower()
        for part in q.split():
            if len(part) > 2 and part in blob:
                score += 2
        if best is None or score > best[0]:
            best = (score, preview, thumb, full)
    if not best:
        return None
    return best[1], best[2], best[3]


def _resolve_masterpiece_work_fast(
    idx: int,
    title: str,
    artist: str,
    date: str,
    desc: str,
) -> dict[str, Any]:
    work = _masterpiece_base_work(idx, title, artist, date, desc)
    work = _apply_masterpiece_image_urls(work, title)
    if work.get("thumb_url"):
        return work
    try:
        from artic_service import search_aic_masterpiece

        resolved = search_aic_masterpiece(title, artist)
        if resolved:
            work = _overlay_masterpiece_images(work, resolved)
            image_id = resolved.get("image_id")
            if image_id:
                from artic_service import AIC_IMAGE_SIZES, _iiif_url

                work["image_id"] = str(image_id)
                work["direct_preview_url"] = _iiif_url(str(image_id), AIC_IMAGE_SIZES["preview"])
                work["direct_thumb_url"] = _iiif_url(str(image_id), AIC_IMAGE_SIZES["thumb"])
                work["direct_image_url"] = _iiif_url(str(image_id), AIC_IMAGE_SIZES["full"])
    except Exception:
        pass
    return work


def _resolve_masterpiece_work(
    idx: int,
    title: str,
    artist: str,
    date: str,
    desc: str,
) -> dict[str, Any]:
    base = _masterpiece_base_work(idx, title, artist, date, desc)
    cache_key = f"masterpiece-work:v2:{idx:02d}:{title.lower()}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    work = _apply_masterpiece_image_urls(base, title)
    if work.get("thumb_url"):
        return _cache_set(cache_key, work)

    resolved: dict[str, Any] | None = None
    try:
        from artic_service import search_aic_masterpiece

        resolved = search_aic_masterpiece(title, artist)
    except Exception:
        resolved = None
    if not resolved:
        try:
            resolved = _search_met_masterpiece(title, artist)
        except urllib.error.HTTPError as exc:
            if exc.code not in (403, 429):
                raise
        except Exception:
            resolved = None

    work = _overlay_masterpiece_images(base, resolved)
    if not work.get("thumb_url") and not work.get("direct_thumb_url"):
        urls = _wikimedia_masterpiece_urls(title, artist, search=True)
        if urls:
            preview, thumb, full = urls
            work["preview_url"] = preview
            work["thumb_url"] = thumb
            work["image_url"] = full
            work["direct_preview_url"] = preview
            work["direct_thumb_url"] = thumb
            work["direct_image_url"] = full
        else:
            work = _apply_masterpiece_image_urls(work, title)

    return _cache_set(cache_key, work)


def build_masterpiece_works(limit: int = 40, *, fast: bool = False) -> list[dict[str, Any]]:
    rows = MASTERPIECE_CATALOG[: max(1, min(limit, 40))]
    if fast:
        return [
            _resolve_masterpiece_work_fast(idx, title, artist, date, desc)
            for idx, (title, artist, date, desc) in enumerate(rows, start=1)
        ]

    works: list[dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = [
            pool.submit(_resolve_masterpiece_work, idx, title, artist, date, desc)
            for idx, (title, artist, date, desc) in enumerate(rows, start=1)
        ]
        for future in as_completed(futures):
            works.append(future.result())
    works.sort(key=lambda w: str(w.get("id") or ""))
    return works


def masterpiece_works_response(limit: int = 40) -> dict[str, Any]:
    works = build_masterpiece_works(limit=limit, fast=True)
    updated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    return {
        "genre": _masterpiece_genre_meta(),
        "works": works,
        "count": len(works),
        "updated_at": updated_at,
        "next_refresh_at": updated_at,
        "trigger": "curated",
        "cached": True,
        "images_cached": any(w.get("thumb_url") or w.get("direct_thumb_url") for w in works),
        "stale": False,
        "cache_ttl_hours": 24,
    }

GENRE_PROFILES: dict[str, dict[str, Any]] = {
    "history": {
        "met_queries": [
            "mythology painting",
            "biblical painting",
            "religious narrative painting",
            "saint painting",
        ],
        "aic_q": "mythology biblical religious narrative saints",
        "title_positive": (
            "mytholog", "biblic", "saint", "madonna", "virgin", "crucif",
            "resurrection", "annunciation", "nativity", "apostle", "moses",
            "judith", "susanna", "daniel", "battle", "triumph", "allegory",
            "venus", "apollo", "diana", "minerva", "bacchus", "perseus",
            "hercules", "odysse", "christ", "holy family", "adoration",
            "flight into egypt", "sacrifice", "martyrdom", "conversion of",
        ),
        "title_negative": (
            "portrait of", "self-portrait", "self portrait",
            "still life", "flowers", "fruit bowl", "costume", "armor",
            "needlework", "wall painting:",
        ),
        "tag_positive": ("mythology", "religion", "biblical", "saints", "christ"),
        "min_score": 3,
    },
    "portrait": {
        "met_queries": ["portrait painting", "self-portrait painting"],
        "aic_q": "portrait self-portrait likeness",
        "title_positive": ("portrait", "self-portrait", "self portrait", "likeness of"),
        "title_negative": (
            "landscape", "still life", "mytholog", "biblic", "view of",
            "flowers", "fruit", "interior with",
        ),
        "tag_positive": ("portraits",),
        "min_score": 3,
    },
    "landscape": {
        "met_queries": ["landscape painting", "seascape painting", "river view painting"],
        "aic_q": "landscape seascape river mountain view",
        "title_positive": (
            "landscape", "view of", "seascape", "coast", "river", "mountain",
            "forest", "meadow", "valley", "harbor", "harbour", "sunset",
            "moonlight", "storm at sea",
        ),
        "title_negative": (
            "portrait", "self-portrait", "still life", "mytholog", "biblic",
            "madonna", "saint ",
        ),
        "tag_positive": ("landscapes", "rivers", "mountains", "trees", "seascapes"),
        "min_score": 3,
    },
    "genre": {
        "met_queries": [
            "genre painting",
            "domestic interior painting",
            "everyday life painting",
        ],
        "aic_q": "genre everyday domestic interior peasants tavern",
        "title_positive": (
            "interior", "kitchen", "tavern", "market", "peasant", "domestic",
            "everyday", "merry company", "card player", "dancer", "family at",
            "inn", "shop", "schoolroom", "laundry", "sewing",
        ),
        "title_negative": (
            "mytholog", "biblic", "saint", "portrait of", "self-portrait",
            "landscape", "still life", "view of", "madonna", "venus",
        ),
        "tag_positive": ("interiors", "everyday", "domestic"),
        "min_score": 2,
    },
    "still_life": {
        "met_queries": [
            "still life painting",
            "flowers fruit painting",
            "vanitas painting",
        ],
        "aic_q": "still life flowers fruit bouquet vanitas",
        "title_positive": (
            "still life", "flowers", "fruit", "bouquet", "vanitas",
            "table with", "dead birds", "hunting trophy",
        ),
        "title_negative": (
            "portrait", "self-portrait", "landscape", "view of",
            "mytholog", "biblic", "saint",
        ),
        "tag_positive": ("flowers", "fruit", "still life"),
        "min_score": 3,
    },
}


def genre_profile(genre_id: str) -> dict[str, Any]:
    profile = GENRE_PROFILES.get(genre_id)
    if not profile:
        raise ValueError(f"Unknown genre: {genre_id}")
    return profile


def _object_tag_terms(obj: dict[str, Any]) -> list[str]:
    return [
        str(tag.get("term") or "").lower()
        for tag in (obj.get("tags") or [])
        if isinstance(tag, dict)
    ]


def score_met_genre_relevance(obj: dict[str, Any], genre_id: str) -> int:
    profile = genre_profile(genre_id)
    if not _is_painting(obj):
        return -100

    title = _strip_accents((obj.get("title") or "").lower())
    dept = (obj.get("department") or "").lower()
    obj_name = (obj.get("objectName") or "").lower()
    tags = _object_tag_terms(obj)

    score = 0
    if "european paintings" in dept:
        score += 2
    elif "american wing" in dept and "painting" in obj_name:
        score += 1

    for kw in profile.get("title_positive", ()):
        if kw in title:
            score += 3
    for kw in profile.get("title_negative", ()):
        if kw in title:
            score -= 6
    for kw in profile.get("tag_positive", ()):
        if any(kw in tag for tag in tags):
            score += 2

    if genre_id == "portrait" and "portrait" in obj_name:
        score += 4
    if genre_id == "still_life" and "still life" in title:
        score += 4
    if genre_id == "landscape" and "landscape" in obj_name:
        score += 2

    return score


def score_aic_genre_relevance(row: dict[str, Any], genre_id: str) -> int:
    profile = genre_profile(genre_id)
    title = _strip_accents(str(row.get("title") or "").lower())
    medium = _strip_accents(str(row.get("medium_display") or "").lower())
    kind = str(row.get("artwork_type_title") or "").lower()

    if "painting" not in kind and kind not in ("oil on canvas", "watercolor"):
        return -100

    score = 0
    for kw in profile.get("title_positive", ()):
        if kw in title:
            score += 3
    for kw in profile.get("title_negative", ()):
        if kw in title:
            score -= 6
    if genre_id == "still_life" and "still life" in medium:
        score += 2
    if genre_id == "portrait" and "portrait" in medium:
        score += 2

    return score

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


ARTIST_EXTRA: dict[str, str] = {
    "Leonardo da Vinci": "어린 시절 피렌체의 베르키오 공방에서 훈련을 받았고, 밀라노에서 루도비코 스포르차 공의 궁정 화가로 활동했습니다. 해부학 스케치와 기계 설계도는 과학과 예술이 분리되지 않았던 르네상스 정신을 보여줍니다. 루브르 《모나리자》는 미소의 미스터리로 유명하며, 《최후의 만찬》은 원근법과 극적 제스처가 결합된 벽화의 걸작입니다. 후대 화가들에게 이상적인 인물 표현의 기준이 되었습니다.",
    "Michelangelo": "피렌체에서 로렌초 데 메디치의 후원을 받으며 고전 조각을 학습했습니다. 《다비드》는 공화주의적 영웅상으로, 《피에타》는 성모의 슬픔을 정적으로 승화했습니다. 시스티나 예배당 천장화는 4년에 걸친 대작업으로, 인체의 웅장함과 성경 서사를 결합했습니다. 건축에서도 성 베드로 대성당 돔을 설계하며 르네상스 공간 미학을 완성했습니다.",
    "Raphael": "우르비노 출신으로 페르지노 문하에서 기초를 닮았습니다. 로마에서 교황 율리오 2세의 후원을 받아 바티칸 스탄체 방을 장식했습니다. 《아테네 학당》은 플라톤과 아리스토텔레스를 중심으로 고전 지성을 시각화한 화면입니다. 균형·우아함·명료함은 이후 아카데미 회화의 이상형이 되었습니다.",
    "Titian": "베네치아의 강한 색채 전통을 이어받아 붓질의 자유로움을 극대화했습니다. 신화화 《바쿠스와 아리아드네》는 역동적 구도와 대비되는 색으로 유명합니다. 스페인 왕실 초상을 맡으며 유럽 궁정 미술의 표준을 세웠습니다. 후기작은 더욱 느슨한 붓질로 빛과 공기를 표현합니다.",
    "Sandro Botticelli": "플로렌스 메디치 가문과 인문주의자들의 교류 속에서 성장했습니다. 선의 리듬과 장식적 패턴이 인물에 서정적 분위기를 부여합니다. 《비너스의 탄생》은 신화를 우아한 윤곽선으로 재해석한 르네상스의 상징입니다. 《봄의 알레고리》는 신화 인물을 꽃과 옷감으로 화려하게 엮어냅니다.",
    "Rembrandt": "레이던을 중심으로 풍부한 상업 네트워크를 형성했습니다. 자화상 연작은 화가의 내면과 세월의 흔적을 솔직하게 기록합니다. 《밤의 순찰》은 빛이 인물군을 가르는 연극적 순간을 포착했습니다. 판화 기법에서도 혁신적이었으며, 네덜란드 황금시대 회화의 정점에 섰습니다.",
    "Caravaggio": "로마에서 처음 주목받으며 젊은 귀족과 교황청의 후원을 받았습니다. 테네브리즘은 한 줄기 빛이 어둠 속 인물을 드러내는 연출입니다. 《성 마태오의 소명》은 손가락 하나로 신적 계시를 표현합니다. 현실적 모델과 거리 풍경은 종교화에 세속적 생동감을 불어넣었습니다.",
    "Peter Paul Rubens": "안트워프에 대규모 공방을 운영하며 많은 후학을 양성했습니다. 신화와 역사를 웅장한 구도와 풍만한 인체로 표현했습니다. 《사모손과 들릴라》 등에서 극적 장면과 색의 화려함이 돋보입니다. 외교관으로도 활동하며 유럽 궁정을 오갔습니다.",
    "Diego Velázquez": "스페인 왕 필리포 4세의 궁정 화가로 오랜 기간 활동했습니다. 왕실 인물을 사실적으로 그리면서도 시선과 공간의 미묘함을 탐구했습니다. 《시녀들》은 거울·화가·모델이 겹치는 회화에 대한 회화입니다. 느슨한 붓질은 인상주의 이전 빛의 실험으로 평가됩니다.",
    "Artemisia Gentileschi": "로마에서 아버지 오라치오의 지도를 받고 카라바조풍을 익혔습니다. 《유디트와 홀로페르네스》는 여성의 결단력을 강렬하게 그린 작품입니다. 피렌체·나폴리·영국에서 활동하며 국제적 명성을 얻었습니다. 당대 여성 예술가의 가능성을 보여준 선구자입니다.",
    "Jean-Antoine Watteau": "플랑드르·파리에서 활동하며 귀족 문화를 섬세하게 포착했습니다. 샹 드리 장르는 산책·음악·극장의 여운을 그립니다. 《시레르로 향하는 행렬》은 잔잔한 색과 가벼운 붓질이 특징입니다. 로코코의 우아하고 몽환적인 분위기를 정의했습니다.",
    "François Boucher": "루이 XV의 궁정 화가로 신화와 풍속을 장식적으로 그렸습니다. 파스텔 톤과 부드러운 곡선이 화면을 채웁니다. 《디아나의 목욕》 등에서 비단 같은 질감이 돋보입니다. 18세기 프랑스 상류층의 취향을 시각화했습니다.",
    "Jean-Honoré Fragonard": "부쉐의 문하에서 훈련받고 로코코 후기 화풍을 완성했습니다. 《그네를 타는 소녀》는 순간의 기쁨과 가벼움을 포착합니다. 정원·연애·극장의 장면을 밝은 색으로 그렸습니다. 낭만주의로 이어지는 감성적 터치가 특징입니다.",
    "Giovanni Battista Tiepolo": "베네치아·빈·마드리드 궁전의 천장화를 맡았습니다. 구름 위 인물 배치로 공간을 열어젖히는 환상적 구도가 특징입니다. 밝은 하늘색과 금빛이 웅장함을 더합니다. 바로크와 로코코를 잇는 베네치아 후기 거장입니다.",
    "Canaletto": "베네치아 운하와 광장을 정밀한 원근으로 기록했습니다. 영국 그랜드 투어객들에게 인기가 많았습니다. 《대운하와 산타 마리아 델라 살루테 예배당》 등이 대표적입니다. 도시 풍경을 예술적 기록으로 승화시킨 선구자입니다.",
    "Eugène Delacroix": "프랑스 낭만주의의 중심에서 색과 동세를 강조했습니다. 《민중을 이끄는 자유의 여신》은 1830년 혁명의 상징입니다. 북아프리카 여행 후 동방적 색채가 더욱 선명해졌습니다. 문학·역사·신화를 격정적으로 재해석했습니다.",
    "Francisco Goya": "스페인 왕실 화가로 시작해 전쟁과 질병 이후 비판적 화가로 변모했습니다. 《5월 3일》은 총격 장면의 공포를 담았습니다. 《검은 그림》은 인간 내면의 어둠을 탐구합니다. 판화 《전쟁의 재앙》은 사진 이전 시대의 강력한 전쟁 기록입니다.",
    "J.M.W. Turner": "영국 풍경과 해양을 빛과 대기로 표현했습니다. 《전함 테메레르호》는 산업 혁명과 자연의 장엄함을 동시에 담습니다. 후기작은 형태가 거의 용해되는 추상에 가까운 빛의 화면입니다. 모네와 인상주의에 결정적 영향을 주었습니다.",
    "John Constable": "서식스 고향 풍경을 반복해 그리며 자연 관찰을 중시했습니다. 구름 스케치는 기상 변화를 과학적으로 기록했습니다. 《건초마차》는 시골 노동과 빛의 서정을 담습니다. 야외 스케치가 후대 풍경화의 토대가 되었습니다.",
    "Jacques-Louis David": "프랑스 혁명과 나폴레옹 시대의 공식 화가였습니다. 고대 로마의 영웅성을 현대 정치와 연결했습니다. 《호라티우스 형제의 맹세》는 공화주의적 희생을 찬미합니다. 명확한 윤곽과 극적 순간 포착이 신고전주의의 표준입니다.",
    "Claude Monet": "알랑·르노아르 등과 함께 인상주의 전시를 열었습니다. 같은 Motif를 시간대별로 반복해 빛의 변화를 기록했습니다. 지베르니 정원의 《수련》 연작은 색이 형태를 대체하는 경험을 제공합니다. 현대 풍경화의 방향을 제시했습니다.",
    "Edgar Degas": "발레리나의 연습 장면을 비정형 구도로 포착했습니다. 사진과 일본 판화에서 영감을 받아 잘린 구도를 사용했습니다. 파스텔과 조각에서도 움직임을 탐구했습니다. 도시 생활의 관찰자로서 인상주의를 확장했습니다.",
    "Pierre-Auguste Renoir": "인상주의 색채로 인물과 야외를 따뜻하게 그렸습니다. 《물랭 드 라 갈리트의 발레》는 파리의 즐거움을 노래합니다. 피부에 스며드는 빛 표현이 특징입니다. 후기에는 고전적 형태와 선명한 윤곽을 추구하기도 했습니다.",
    "Camille Pissarro": "농촌과 도시 풍경을 꾸준히 그리며 색의 조화를 탐구했습니다. 세잔·고갱 등 후배를 격려한 멘토였습니다. 《적목 효과, 퐁투아즈》에서 점묘법을 실험했습니다. 인상주의에서 후기 인상주의로 이어지는 다작 화가입니다.",
    "Mary Cassatt": "파리에서 드가와 인상주의 전시에 참여했습니다. 어머니와 아이의 일상을 따뜻하게 그렸습니다. 일본 우키요에의 평면적 구도를 흡수했습니다. 《차를 마시는 사람》은 손짓과 시선의 친밀함이 특징입니다.",
    "Vincent van Gogh": "네덜란드 시기의 어두운 풍속화에서 프로방스의 강렬한 색으로 전환했습니다. 고갱과의 교류 후 표현이 더욱 과감해졌습니다. 《해바라기》《별이 빛나는 밤》은 감정의 에너지가 화면을 가득 채웁니다. 생전에는 드물게 인정받았으나 오늘날 가장 사랑받는 화가입니다.",
    "Paul Cézanne": "에크스 프로방스에서 정물과 산을 반복해 그리며 형태를 분석했습니다. 사과·병·과일을 기하학적으로 재구성했습니다. 《생자수테 산》 연작은 색 면이 구조를 만듭니다. ‘현대 회화의 아버지’로 불리며 입체주의의 토대를 마련했습니다.",
    "Paul Gauguin": "증권 중개인에서 화가로 전향한 뒤 브르타뉴·타히티를 여행했습니다. 서구 문명에 대한 이탈과 원시적 상징을 추구했습니다. 《우리는 어디서 왔는가》는 평면적 색면과 종교적 상징이 결합됩니다. 후기 인상주의에서 상징주의로 이어지는 다리입니다.",
    "Henri Matisse": "야수파 이후 대담한 색면과 장식적 구도로 현대 회화를 이끌었습니다. 《춤》《음악》은 색만으로 리듬과 기쁨을 전달합니다. 종이 오리기(구텀부아)로도 혁신했습니다. ‘예술은 편안한 의자’라는 신념으로 유명합니다.",
    "Pablo Picasso": "바르셀로나·파리에서 모더니즘을 개척했습니다. 《아비뇽의 처녀들》은 입체주의의 시작을 알렸습니다. 《게르니카》는 스페인 내전의 참상을 흑백 상징으로 승화했습니다. 회색·로즈·입체·신고전 등 끊임없는 화풍 변화로 20세기 미술을 재정의했습니다.",
}


def _met_small_thumb(url: str | None) -> str | None:
    if not url:
        return url
    for big, small in (
        ("/web-large/", "/web-small/"),
        ("/original/", "/web-small/"),
        ("/web-additional/", "/web-small/"),
    ):
        if big in url:
            return url.replace(big, small, 1)
    return url


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
    fresh: bool = False,
) -> tuple[list[int], int]:
    cache_key = f"met-search:v1:{query.lower()}:artist={artist}"
    if not fresh:
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
    if not fresh:
        _cache_set(cache_key, (ids, total))
    return list(ids[:max_ids]), total


def _met_search_multi_ids(
    queries: list[str],
    *,
    max_ids: int = 200,
    artist: bool = False,
    fresh: bool = False,
) -> list[int]:
    seen: set[int] = set()
    merged: list[int] = []
    per_query = max(32, max_ids // max(len(queries), 1))
    for query in queries:
        ids, _ = _met_search(query, artist=artist, max_ids=per_query + 24, fresh=fresh)
        for oid in ids:
            if oid in seen:
                continue
            seen.add(oid)
            merged.append(oid)
            if len(merged) >= max_ids:
                return merged
    if fresh:
        random.shuffle(merged)
    return merged


def fetch_met_genre_works(
    genre_id: str,
    limit: int = 10,
    *,
    fresh: bool = False,
) -> list[dict[str, Any]]:
    profile = genre_profile(genre_id)
    min_score = int(profile.get("min_score", 2))
    pool_size = max(limit * 14, 100)
    ids = _met_search_multi_ids(profile["met_queries"], max_ids=pool_size, fresh=fresh)
    if fresh and ids:
        random.shuffle(ids)

    scored: list[tuple[int, dict[str, Any]]] = []
    seen: set[int] = set()
    for object_id in ids:
        if len(scored) >= limit * 5:
            break
        obj = _met_object(object_id)
        if not obj:
            continue
        relevance = score_met_genre_relevance(obj, genre_id)
        if relevance < min_score:
            continue
        work = _normalize_met_object(obj)
        if not work:
            continue
        wid = work.get("id")
        if wid in seen:
            continue
        seen.add(wid)
        scored.append((relevance, work))

    scored.sort(key=lambda pair: -pair[0])
    pool = [work for _, work in scored]
    if len(pool) > limit:
        slice_size = limit * 4 if fresh else max(limit * 2, limit)
        pool = pool[:slice_size]
        random.shuffle(pool)
    return _apply_korean_descriptions(pool[:limit])


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


def _is_drawing_or_print(obj: dict[str, Any]) -> bool:
    obj_name = (obj.get("objectName") or "").lower()
    if any(k in obj_name for k in ("drawing", "print", "etching", "engraving", "woodcut")):
        return True
    classification = str(obj.get("classification") or "").lower()
    if any(k in classification for k in ("drawing", "print")):
        return True
    dept = (obj.get("department") or "").lower()
    return "drawings" in dept or "prints" in dept


def _is_visual_artwork(obj: dict[str, Any]) -> bool:
    return _is_painting(obj) or _is_drawing_or_print(obj)


ARTIST_DRAWING_HEAVY: frozenset[str] = frozenset(
    {
        "Leonardo da Vinci",
        "Michelangelo",
        "Raphael",
        "Sandro Botticelli",
        "Edgar Degas",
    }
)

ARTIST_MET_EXTRA_QUERIES: dict[str, list[str]] = {
    "Leonardo da Vinci": ["Vinci Leonardo da"],
    "Michelangelo": ["Michelangelo Buonarroti"],
    "Raphael": ["Raffaello Sanzio", "Raphael Sanzio"],
    "Sandro Botticelli": ["Botticelli"],
    "Titian": ["Tiziano Vecellio"],
    "Caravaggio": ["Michelangelo Merisi da Caravaggio"],
    "Edgar Degas": ["Hilaire Germain Edgar Degas"],
}

ARTIST_DISPLAY_ALIASES: dict[str, list[str]] = {
    "Leonardo da Vinci": ["vinci, leonardo da"],
    "Michelangelo": ["michelangelo buonarroti", "buonarroti, michelangelo"],
    "Raphael": ["raffaello sanzio", "raphael sanzio"],
    "Titian": ["tiziano vecellio", "vecellio, tiziano"],
    "Caravaggio": ["michelangelo merisi"],
}


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
    allow_drawings: bool = False,
    artist_name: str | None = None,
    artist_search: str | None = None,
) -> list[dict[str, Any]]:
    works: list[dict[str, Any]] = []
    seen: set[int] = set()
    filter_name = artist_name or ""
    filter_search = artist_search or (_artist_search_name(filter_name) if filter_name else "")
    for object_id in object_ids:
        if len(works) >= limit:
            break
        obj = _met_object(object_id)
        if not obj:
            continue
        if filter_name:
            display = str(obj.get("artistDisplayName") or "")
            if not _object_matches_artist(display, filter_name, filter_search):
                continue
        if paintings_only:
            ok = _is_visual_artwork(obj) if allow_drawings else _is_painting(obj)
            if not ok:
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
    from art_cache import get_genre_works_response

    if is_masterpiece_genre(genre_id):
        return get_genre_works_response(genre_id, limit=40)
    return get_genre_works_response(genre_id, limit=limit)


def _artist_display_aliases(canonical: str) -> list[str]:
    return list(ARTIST_DISPLAY_ALIASES.get(canonical, []))


def _artist_met_search_queries(name: str, search_name: str) -> list[str]:
    extras = ARTIST_MET_EXTRA_QUERIES.get(name) or ARTIST_MET_EXTRA_QUERIES.get(search_name) or []
    return list(dict.fromkeys([name, search_name, *extras]))


def _met_search_artist_ids(
    name: str,
    search_name: str,
    *,
    max_ids: int = 200,
) -> list[int]:
    seen: set[int] = set()
    merged: list[int] = []
    queries = _artist_met_search_queries(name, search_name)
    per_query = max(48, max_ids // max(len(queries), 1))
    for query in queries:
        try:
            ids, _ = _met_search(query, artist=False, max_ids=per_query + 32)
        except urllib.error.HTTPError as exc:
            if exc.code in (403, 429):
                continue
            raise
        for oid in ids:
            if oid in seen:
                continue
            seen.add(oid)
            merged.append(oid)
            if len(merged) >= max_ids:
                return merged
    return merged


def _artist_search_name(name: str) -> str:
    aliases = {
        "Rembrandt van Rijn": "Rembrandt",
        "Michelangelo": "Michelangelo Buonarroti",
        "Francisco Goya": "Francisco Goya y Lucientes",
        "Francisco José de Goya y Lucientes": "Francisco Goya",
        "J.M.W. Turner": "Joseph Mallord William Turner",
        "Allen Turner": "Joseph Mallord William Turner",
        "Edgar Degas": "Hilaire Germain Edgar Degas",
        "Paul Cezanne": "Paul Cézanne",
        "Jean Honoré Fragonard": "Jean-Honoré Fragonard",
        "Jean Antoine Watteau": "Jean-Antoine Watteau",
        "Jacques Louis David": "Jacques-Louis David",
        "Pierre-Auguste Renoir": "Pierre Auguste Renoir",
        "Giovanni Battista Tiepolo": "Giambattista Tiepolo",
        "Polidoro da Caravaggio": "Caravaggio",
        "School of Rembrandt van Rijn": "Rembrandt",
    }
    return aliases.get(name, name)


def _normalize_artist_key(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").lower().strip())


def _significant_artist_tokens(name: str) -> list[str]:
    skip = {
        "da", "de", "del", "van", "von", "di", "le", "la", "the", "of", "and",
        "y", "ii", "iii", "jean", "jose", "josé",
    }
    parts = re.split(r"[\s,.]+", _normalize_artist_key(name))
    return [p for p in parts if len(p) >= 3 and p not in skip]


def _secondary_artist_markers(display: str) -> bool:
    hay = display.lower()
    markers = (
        "school of",
        "follower of",
        "circle of",
        "workshop of",
        "after ",
        "manner of",
        "style of",
        "attributed to",
        "studio of",
        "copy after",
        "possibly by",
        "formerly attributed",
    )
    return any(m in hay for m in markers)


def _object_matches_artist(display: str, canonical: str, search: str) -> bool:
    hay = _normalize_artist_key(display)
    if not hay or hay == "unknown artist":
        return False
    if _secondary_artist_markers(hay):
        return False
    for candidate in (canonical, search, *_artist_display_aliases(canonical)):
        c = _normalize_artist_key(candidate)
        if c and c in hay:
            return True
    tokens = _significant_artist_tokens(canonical) or _significant_artist_tokens(search)
    if not tokens:
        return False
    if len(tokens) == 1:
        return tokens[0] in hay
    surname = tokens[-1]
    if surname not in hay:
        return False
    matched = sum(1 for t in tokens if t in hay)
    return matched >= min(2, len(tokens))


def _strip_accents(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text or "")
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))


def _normalize_title_key(title: str) -> str:
    t = _strip_accents((title or "").lower().strip())
    t = re.sub(r"\([^)]*\)", " ", t)
    t = re.sub(r"\[[^\]]*\]", " ", t)
    t = re.sub(r"[^\w\s]", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    t = re.sub(r"^(the|a|an)\s+", "", t)
    t = re.sub(r",?\s*\d{4}\s*(?:\-\s*\d{4})?$", "", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def _artist_dedupe_signature(artist: str) -> str:
    tokens = _significant_artist_tokens(artist)
    if not tokens:
        return _normalize_artist_key(artist)
    if len(tokens) == 1:
        return tokens[0]
    return f"{tokens[-1]}:{tokens[0]}"


def _titles_likely_same(a: str, b: str) -> bool:
    if not a or not b:
        return False
    if a == b:
        return True
    shorter, longer = (a, b) if len(a) <= len(b) else (b, a)
    if len(shorter) < 6:
        return False
    return shorter in longer


def _work_dedupe_key(work: dict[str, Any], *, context_artist: str | None = None) -> str:
    title = _normalize_title_key(work.get("title"))
    if not title or title == "untitled":
        wid = work.get("id")
        if wid:
            return f"id:{wid}"
    artist_sig = _artist_dedupe_signature(context_artist or work.get("artist") or "")
    return f"{title}|{artist_sig}"


def _is_duplicate_work(
    work: dict[str, Any],
    seen_keys: set[str],
    seen_pairs: list[tuple[str, str]],
    *,
    context_artist: str | None = None,
) -> bool:
    key = _work_dedupe_key(work, context_artist=context_artist)
    if key in seen_keys:
        return True
    title_key = _normalize_title_key(work.get("title"))
    artist_sig = _artist_dedupe_signature(context_artist or work.get("artist") or "")
    for prev_title, prev_artist in seen_pairs:
        if artist_sig == prev_artist and _titles_likely_same(title_key, prev_title):
            return True
    return False


def merge_artwork_lists(
    *lists: list[dict[str, Any]],
    limit: int,
    context_artist: str | None = None,
) -> list[dict[str, Any]]:
    merged: list[dict[str, Any]] = []
    seen_keys: set[str] = set()
    seen_pairs: list[tuple[str, str]] = []
    for batch in lists:
        for work in batch:
            if _is_duplicate_work(work, seen_keys, seen_pairs, context_artist=context_artist):
                continue
            key = _work_dedupe_key(work, context_artist=context_artist)
            title_key = _normalize_title_key(work.get("title"))
            artist_sig = _artist_dedupe_signature(context_artist or work.get("artist") or "")
            seen_keys.add(key)
            seen_pairs.append((title_key, artist_sig))
            merged.append(work)
            if len(merged) >= limit:
                return merged
    return merged


def _artist_portrait(name: str) -> dict[str, str | None]:
    return {
        "preview_url": portrait_proxy_path(name, 120),
        "thumb_url": portrait_proxy_path(name, 200),
        "image_url": portrait_proxy_path(name, 320),
    }


def _fetch_met_artist_works(
    name: str,
    search_name: str,
    object_ids: list[int],
    limit: int,
) -> list[dict[str, Any]]:
    allow_drawings = name in ARTIST_DRAWING_HEAVY
    met_works = _fetch_met_works_from_ids(
        object_ids,
        limit=limit,
        artist_name=name,
        artist_search=search_name,
        allow_drawings=allow_drawings,
    )
    min_before_supplement = max(3, limit // 4)
    if len(met_works) >= limit or (not allow_drawings and len(met_works) >= min_before_supplement):
        return met_works
    extra = _fetch_met_works_from_ids(
        object_ids,
        limit=limit * 2,
        artist_name=name,
        artist_search=search_name,
        allow_drawings=True,
    )
    return merge_artwork_lists(met_works, extra, limit=limit, context_artist=name)


def _artist_works(name: str, limit: int = 60) -> list[dict[str, Any]]:
    from artic_service import fetch_aic_artist_works

    search_name = _artist_search_name(name)
    cache_key = f"artist-works:v9:wiki-thumb:{name.lower()}:n={limit}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    aic_works = _apply_korean_descriptions(
        fetch_aic_artist_works(
            name,
            search_name,
            limit=limit,
            allow_drawings=name in ARTIST_DRAWING_HEAVY,
        )
    )
    met_works: list[dict[str, Any]] = []
    if len(aic_works) < limit:
        met_target = max(limit - len(aic_works), limit // 3)
        ids = _met_search_artist_ids(name, search_name, max_ids=max(met_target * 4, 80))
        if ids:
            try:
                met_works = _apply_korean_descriptions(
                    _fetch_met_artist_works(name, search_name, ids, met_target)
                )
            except urllib.error.HTTPError as exc:
                if exc.code not in (403, 429):
                    raise
    works = merge_artwork_lists(met_works, aic_works, limit=limit, context_artist=name)
    if not works:
        works = _artist_cdn_samples(name, limit)
    elif len(works) < min(limit, 3):
        works = merge_artwork_lists(
            works,
            _artist_cdn_samples(name, limit),
            limit=limit,
            context_artist=name,
        )
    return _cache_set(cache_key, works)


def _artist_sample_works(name: str, object_ids: list[int], limit: int = 3) -> list[dict[str, Any]]:
    if not object_ids:
        return []
    search_name = _artist_search_name(name)
    works = _apply_korean_descriptions(
        _fetch_met_artist_works(name, search_name, object_ids, limit)
    )
    return [
        {
            "id": w.get("id"),
            "title": w.get("title") or "Untitled",
            "date": w.get("date") or "",
            "thumb_url": _met_small_thumb(w.get("thumb_url")),
            "image_url": w.get("image_url"),
            "direct_thumb_url": _met_small_thumb(w.get("direct_thumb_url")),
            "direct_image_url": w.get("direct_image_url"),
        }
        for w in works[:limit]
    ]


def _artist_card(name: str, era: dict[str, Any]) -> dict[str, Any]:
    portrait = _artist_portrait(name)
    info = ARTIST_INFO.get(name) or ARTIST_INFO.get(_artist_search_name(name)) or {}
    extra = ARTIST_EXTRA.get(name) or ARTIST_EXTRA.get(_artist_search_name(name)) or ""
    life = info.get("life", "")
    description = info.get("description") or f"{name}은(는) {era['label']} 시기를 대표하는 화가입니다."
    if extra:
        description = f"{description}\n\n{extra}"

    samples = _artist_cdn_samples(name, 3)
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
        "sample_count": len(samples),
        "sample_works": samples,
    }


def fetch_artist_samples(name: str, limit: int = 3) -> dict[str, Any]:
    from artic_service import fetch_aic_artist_works

    search_name = _artist_search_name(name)
    aic_pool = fetch_aic_artist_works(
        name,
        search_name,
        limit=limit * 2,
        allow_drawings=name in ARTIST_DRAWING_HEAVY,
    )
    aic_samples = [
        {
            "id": w.get("id"),
            "title": w.get("title") or "Untitled",
            "artist": name,
            "date": w.get("date") or "",
            "thumb_url": w.get("thumb_url"),
            "image_url": w.get("image_url"),
            "direct_thumb_url": w.get("direct_thumb_url"),
            "direct_image_url": w.get("direct_image_url"),
        }
        for w in aic_pool
    ]
    if len(aic_samples) >= limit:
        return {"name": name, "sample_works": aic_samples[:limit]}

    cdn_only = _artist_cdn_samples(name, limit)
    ids = _met_search_artist_ids(name, search_name, max_ids=24)
    met_samples = _artist_sample_works(name, ids, limit=limit) if ids else []
    for row in met_samples:
        row["artist"] = name
    merged = merge_artwork_lists(met_samples, aic_samples, limit=limit, context_artist=name)
    if len(merged) < limit:
        merged = merge_artwork_lists(merged, cdn_only, limit=limit, context_artist=name)
    return {"name": name, "sample_works": merged or cdn_only}


def fetch_eras_artists() -> list[dict[str, Any]]:
    cache_key = "eras:met+aic:v11:wiki-thumb"
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
    info = ARTIST_INFO.get(name) or ARTIST_INFO.get(search_name) or {}
    return {
        "artist": {
            "name": name,
            "description": info.get("description") or f"{name} — 대표 작품 감상.",
            "life": info.get("life") or "",
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
    from art_cache import load_portrait_disk, save_portrait_disk

    width = max(120, min(int(width), 640))
    disk = load_portrait_disk(name, width)
    if disk:
        return disk

    thumb_url = _resolve_portrait_thumb_url(name, width)
    if not thumb_url:
        raise ValueError("Portrait not found")

    data, content_type = _fetch_bytes(thumb_url)
    save_portrait_disk(name, width, data, content_type)
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

    search_name = _artist_search_name(name)
    ids: list[int] = []
    try:
        ids, _ = _met_search(search_name, artist=True, max_ids=6)
    except urllib.error.HTTPError as exc:
        if exc.code not in (403, 429):
            raise
    for object_id in ids:
        obj = _met_object(object_id)
        if not obj:
            continue
        urls = _met_image_urls(obj)
        if not urls:
            continue
        _, thumb, _ = urls
        return thumb or urls[0]
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
