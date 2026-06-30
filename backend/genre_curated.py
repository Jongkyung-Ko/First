"""Per-genre curated artwork lists (20 each) for fast CDN bootstrap."""

from __future__ import annotations

from typing import Any

GENRE_WORK_TARGET = 20
MASTERPIECE_WORK_TARGET = 40

# (title, artist, date, description, image_url)
GENRE_CURATED_ENTRIES: dict[str, list[tuple[str, str, str, str, str]]] = {
    "history": [
        ("The Birth of Venus", "Sandro Botticelli", "c. 1484", "르네상스 신화화의 대표작입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Sandro_Botticelli_-_La_nascita_di_Venere_-_Google_Art_Project_-_edited.jpg/960px-Sandro_Botticelli_-_La_nascita_di_Venere_-_Google_Art_Project_-_edited.jpg"),
        ("The Creation of Adam", "Michelangelo", "c. 1511", "시스티나 예배당 천장화의 상징 장면입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Michelangelo_-_Creation_of_Adam_%28cropped%29.jpg/960px-Michelangelo_-_Creation_of_Adam_%28cropped%29.jpg"),
        ("The School of Athens", "Raphael", "1509", "고전 지식인을 한자리에 모은 역사·철학 화입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/%22The_School_of_Athens%22_by_Raffaello_Sanzio_da_Urbino.jpg/960px-%22The_School_of_Athens%22_by_Raffaello_Sanzio_da_Urbino.jpg"),
        ("Liberty Leading the People", "Eugène Delacroix", "1830", "혁명의 열기를 담은 낭만주의 역사화입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/La_Libert%C3%A9_guidant_le_peuple_-_Eug%C3%A8ne_Delacroix_-_Mus%C3%A9e_du_Louvre_Peintures_RF_129_-_apr%C3%A8s_restauration_2024.jpg/960px-La_Libert%C3%A9_guidant_le_peuple_-_Eug%C3%A8ne_Delacroix_-_Mus%C3%A9e_du_Louvre_Peintures_RF_129_-_apr%C3%A8s_restauration_2024.jpg"),
        ("The Third of May 1808", "Francisco Goya", "1814", "전쟁의 폭력을 고발한 역사화 걸작입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/El_Tres_de_Mayo%2C_by_Francisco_de_Goya%2C_from_Prado_thin_black_margin.jpg/960px-El_Tres_de_Mayo%2C_by_Francisco_de_Goya%2C_from_Prado_thin_black_margin.jpg"),
        ("The Garden of Earthly Delights", "Hieronymus Bosch", "c. 1490", "인간 욕망과 종말을 상징하는 삼면 화입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/The_Garden_of_earthly_delights.jpg/960px-The_Garden_of_earthly_delights.jpg"),
        ("Guernica", "Pablo Picasso", "1937", "전쟁의 비극을 고발하는 20세기 역사·반전 화입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Guernica.jpg/960px-Guernica.jpg"),
        ("The Last Supper", "Leonardo da Vinci", "c. 1495", "성서의 결정적 순간을 담은 종교 역사화입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/The_Last_Supper_-_Leonardo_Da_Vinci_-_High_Resolution_32x16.jpg/960px-The_Last_Supper_-_Leonardo_Da_Vinci_-_High_Resolution_32x16.jpg"),
        ("Saturn Devouring His Son", "Francisco Goya", "c. 1819", "신화적 잔혹성을 극적으로 그린 작품입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Francisco_de_Goya%2C_Saturno_devorando_a_su_hijo_%281819-1823%29.jpg/960px-Francisco_de_Goya%2C_Saturno_devorando_a_su_hijo_%281819-1823%29.jpg"),
        ("The Night Watch", "Rembrandt", "1642", "시민 민병대를 극적 장면으로 그린 역사·군사 화입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/La_ronda_de_noche%2C_por_Rembrandt_van_Rijn.jpg/960px-La_ronda_de_noche%2C_por_Rembrandt_van_Rijn.jpg"),
        ("Las Meninas", "Diego Velázquez", "1656", "궁정의 순간을 서사적으로 구성한 작품입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Las_Meninas%2C_by_Diego_Vel%C3%A1zquez%2C_from_Prado_in_Google_Earth.jpg/960px-Las_Meninas%2C_by_Diego_Vel%C3%A1zquez%2C_from_Prado_in_Google_Earth.jpg"),
        ("The Swing", "Jean-Honoré Fragonard", "1767", "귀족 사랑의 은밀한 장면을 그린 로코코 회화입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/The_Swing_%28P430%29.jpg/960px-The_Swing_%28P430%29.jpg"),
        ("The Sleeping Gypsy", "Henri Rousseau", "1897", "몽환적 서사를 담은 상징적 장면입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/La_Boh%C3%A9mienne_endormie.jpg/960px-La_Boh%C3%A9mienne_endormie.jpg"),
        ("Christina's World", "Andrew Wyeth", "1948", "고독과 기다림을 서사적으로 담은 작품입니다.", "https://upload.wikimedia.org/wikipedia/en/thumb/7/76/Christinasworld.jpg/960px-Christinasworld.jpg"),
        ("Olympia", "Édouard Manet", "1863", "근대 미술의 전환을 알린 상징적 인물화·서사 작품입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Edouard_Manet_-_Olympia_-_Google_Art_ProjectFXD.jpg/960px-Edouard_Manet_-_Olympia_-_Google_Art_ProjectFXD.jpg"),
        ("The Son of Man", "René Magritte", "1964", "초현실주의적 상징 장면입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Noun_project_-_The_Son_of_Man_-_in_frame_colored.png/960px-Noun_project_-_The_Son_of_Man_-_in_frame_colored.png"),
        ("The Persistence of Memory", "Salvador Dalí", "1931", "초현실주의 상징 세계를 보여줍니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/Dargenta_%26_Salvador_Dali_The_persistance_of_Memory.png/960px-Dargenta_%26_Salvador_Dali_The_persistance_of_Memory.png"),
        ("A Sunday Afternoon on the Island of La Grande Jatte", "Georges Seurat", "1884", "도시인의 휴일을 서사적으로 기록한 작품입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/A_Sunday_on_La_Grande_Jatte%2C_Georges_Seurat%2C_1884.jpg/960px-A_Sunday_on_La_Grande_Jatte%2C_Georges_Seurat%2C_1884.jpg"),
        ("The Kiss", "Gustav Klimt", "1907", "사랑과 황금 장식의 상징적 장면입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/The_Kiss_-_Gustav_Klimt_-_Google_Cultural_Institute.jpg/960px-The_Kiss_-_Gustav_Klimt_-_Google_Cultural_Institute.jpg"),
        ("The Great Wave off Kanagawa", "Katsushika Hokusai", "c. 1831", "자연의 위력을 서사적으로 표현한 우키요에입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Tsunami_by_hokusai_19th_century.jpg/960px-Tsunami_by_hokusai_19th_century.jpg"),
    ],
    "portrait": [
        ("Mona Lisa", "Leonardo da Vinci", "c. 1503", "가장 유명한 초상화로 미소와 시선이 특징입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Mona_Lisa%2C_by_Leonardo_da_Vinci%2C_from_C2RMF_retouched.jpg/960px-Mona_Lisa%2C_by_Leonardo_da_Vinci%2C_from_C2RMF_retouched.jpg"),
        ("Girl with a Pearl Earring", "Johannes Vermeer", "c. 1665", "빛과 시선이 돋보이는 바로크 초상화입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/1665_Girl_with_a_Pearl_Earring.jpg/960px-1665_Girl_with_a_Pearl_Earring.jpg"),
        ("American Gothic", "Grant Wood", "1930", "미국 농촌 부부의 상징적 초상입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/Grant_Wood_-_American_Gothic_-_Google_Art_Project.jpg/960px-Grant_Wood_-_American_Gothic_-_Google_Art_Project.jpg"),
        ("The Arnolfini Portrait", "Jan van Eyck", "1434", "상징이 풍부한 북유럽 르네상스 초상화입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/Van_Eyck_-_Arnolfini_Portrait.jpg/960px-Van_Eyck_-_Arnolfini_Portrait.jpg"),
        ("The Scream", "Edvard Munch", "1893", "내면의 불안을 담은 표현적 초상·자화상입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Edvard_Munch%2C_1893%2C_The_Scream%2C_oil%2C_tempera_and_pastel_on_cardboard%2C_91_x_73_cm%2C_National_Gallery_of_Norway.jpg/960px-Edvard_Munch%2C_1893%2C_The_Scream%2C_oil%2C_tempera_and_pastel_on_cardboard%2C_91_x_73_cm%2C_National_Gallery_of_Norway.jpg"),
        ("Whistler's Mother", "James McNeill Whistler", "1871", "절제된 구성의 상징적 초상화입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Whistlers_Mother_high_res.jpg/960px-Whistlers_Mother_high_res.jpg"),
        ("Olympia", "Édouard Manet", "1863", "현대 초상화의 전환점으로 평가받습니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Edouard_Manet_-_Olympia_-_Google_Art_ProjectFXD.jpg/960px-Edouard_Manet_-_Olympia_-_Google_Art_ProjectFXD.jpg"),
        ("Las Meninas", "Diego Velázquez", "1656", "시선과 공간을 탐구한 궁정 초상화입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Las_Meninas%2C_by_Diego_Vel%C3%A1zquez%2C_from_Prado_in_Google_Earth.jpg/960px-Las_Meninas%2C_by_Diego_Vel%C3%A1zquez%2C_from_Prado_in_Google_Earth.jpg"),
        ("The Night Watch", "Rembrandt", "1642", "집단 초상의 걸작입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/La_ronda_de_noche%2C_por_Rembrandt_van_Rijn.jpg/960px-La_ronda_de_noche%2C_por_Rembrandt_van_Rijn.jpg"),
        ("The Kiss", "Gustav Klimt", "1907", "금박과 인물이 결합된 상징적 초상입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/The_Kiss_-_Gustav_Klimt_-_Google_Cultural_Institute.jpg/960px-The_Kiss_-_Gustav_Klimt_-_Google_Cultural_Institute.jpg"),
        ("Luncheon of the Boating Party", "Pierre-Auguste Renoir", "1881", "인물과 빛이 조화를 이루는 단체 초상화입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Pierre-Auguste_Renoir_-_Luncheon_of_the_Boating_Party_-_Google_Art_Project.jpg/960px-Pierre-Auguste_Renoir_-_Luncheon_of_the_Boating_Party_-_Google_Art_Project.jpg"),
        ("Dance at Le Moulin de la Galette", "Pierre-Auguste Renoir", "1876", "파리의 젊은이들을 담은 단체 초상화입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Renoir%2C_Pierre-Auguste_-_Dance_at_Le_Moulin_de_la_Galette%2C_1876.jpg/960px-Renoir%2C_Pierre-Auguste_-_Dance_at_Le_Moulin_de_la_Galette%2C_1876.jpg"),
        ("The Card Players", "Paul Cézanne", "c. 1890", "인물 집중과 구도가 뛰어난 작품입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Les_Joueurs_de_cartes%2C_par_Paul_C%C3%A9zanne.jpg/960px-Les_Joueurs_de_cartes%2C_par_Paul_C%C3%A9zanne.jpg"),
        ("Christina's World", "Andrew Wyeth", "1948", "인물과 풍경이 결합된 상징적 초상 장면입니다.", "https://upload.wikimedia.org/wikipedia/en/thumb/7/76/Christinasworld.jpg/960px-Christinasworld.jpg"),
        ("The Son of Man", "René Magritte", "1964", "얼굴을 가린 인물의 초현실 초상입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Noun_project_-_The_Son_of_Man_-_in_frame_colored.png/960px-Noun_project_-_The_Son_of_Man_-_in_frame_colored.png"),
        ("A Sunday Afternoon on the Island of La Grande Jatte", "Georges Seurat", "1884", "도시인들의 단체 초상적 장면입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/A_Sunday_on_La_Grande_Jatte%2C_Georges_Seurat%2C_1884.jpg/960px-A_Sunday_on_La_Grande_Jatte%2C_Georges_Seurat%2C_1884.jpg"),
        ("The Swing", "Jean-Honoré Fragonard", "1767", "귀족 여인의 초상적 장면입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/The_Swing_%28P430%29.jpg/960px-The_Swing_%28P430%29.jpg"),
        ("The Sleeping Gypsy", "Henri Rousseau", "1897", "인물과 사자가 대비되는 상징적 장면입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/La_Boh%C3%A9mienne_endormie.jpg/960px-La_Boh%C3%A9mienne_endormie.jpg"),
        ("The Birth of Venus", "Sandro Botticelli", "c. 1484", "신화 속 인물 초상화입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Sandro_Botticelli_-_La_nascita_di_Venere_-_Google_Art_Project_-_edited.jpg/960px-Sandro_Botticelli_-_La_nascita_di_Venere_-_Google_Art_Project_-_edited.jpg"),
        ("The Creation of Adam", "Michelangelo", "c. 1511", "인간 창조의 상징적 인물 장면입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Michelangelo_-_Creation_of_Adam_%28cropped%29.jpg/960px-Michelangelo_-_Creation_of_Adam_%28cropped%29.jpg"),
    ],
    "landscape": [
        ("The Starry Night", "Vincent van Gogh", "1889", "소용돌이치는 밤하늘의 대표적 풍경화입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg/960px-Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg"),
        ("Water Lilies", "Claude Monet", "1914", "연못과 수련을 그린 인상주의 풍경화입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Claude_Monet_-_Water_Lilies_-_Google_Art_Project.jpg/960px-Claude_Monet_-_Water_Lilies_-_Google_Art_Project.jpg"),
        ("The Great Wave off Kanagawa", "Katsushika Hokusai", "c. 1831", "파도와 후지산의 상징적 풍경 판화입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Tsunami_by_hokusai_19th_century.jpg/960px-Tsunami_by_hokusai_19th_century.jpg"),
        ("The Hay Wain", "John Constable", "1821", "영국 시골 풍경화의 대표작입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/John_Constable_-_The_Hay_Wain_%281821%29.jpg/960px-John_Constable_-_The_Hay_Wain_%281821%29.jpg"),
        ("Impression, Sunrise", "Claude Monet", "1872", "인상주의의 이름을 남긴 항구 풍경입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/5/59/Monet_-_Impression%2C_Sunrise.jpg/960px-Monet_-_Impression%2C_Sunrise.jpg"),
        ("Cafe Terrace at Night", "Vincent van Gogh", "1888", "별이 빛나는 거리 풍경입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Vincent-van-gogh-cafe-terrace-on-the-place-du-forum-arles-at-night-the.jpg/960px-Vincent-van-gogh-cafe-terrace-on-the-place-du-forum-arles-at-night-the.jpg"),
        ("Christina's World", "Andrew Wyeth", "1948", "넓은 들판과 집을 담은 미국 풍경화입니다.", "https://upload.wikimedia.org/wikipedia/en/thumb/7/76/Christinasworld.jpg/960px-Christinasworld.jpg"),
        ("The Sleeping Gypsy", "Henri Rousseau", "1897", "사막과 달빛의 몽환적 풍경입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/La_Boh%C3%A9mienne_endormie.jpg/960px-La_Boh%C3%A9mienne_endormie.jpg"),
        ("Liberty Leading the People", "Eugène Delacroix", "1830", "도시와 인물이 어우러진 역사 풍경입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/La_Libert%C3%A9_guidant_le_peuple_-_Eug%C3%A8ne_Delacroix_-_Mus%C3%A9e_du_Louvre_Peintures_RF_129_-_apr%C3%A8s_restauration_2024.jpg/960px-La_Libert%C3%A9_guidant_le_peuple_-_Eug%C3%A8ne_Delacroix_-_Mus%C3%A9e_du_Louvre_Peintures_RF_129_-_apr%C3%A8s_restauration_2024.jpg"),
        ("The Garden of Earthly Delights", "Hieronymus Bosch", "c. 1490", "환상적 자연과 인간 세계의 풍경입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/The_Garden_of_earthly_delights.jpg/960px-The_Garden_of_earthly_delights.jpg"),
        ("The Third of May 1808", "Francisco Goya", "1814", "밤의 도시 광경과 비극적 장면입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/El_Tres_de_Mayo%2C_by_Francisco_de_Goya%2C_from_Prado_thin_black_margin.jpg/960px-El_Tres_de_Mayo%2C_by_Francisco_de_Goya%2C_from_Prado_thin_black_margin.jpg"),
        ("Guernica", "Pablo Picasso", "1937", "파괴된 도시를 상징하는 풍경적 구성입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Guernica.jpg/960px-Guernica.jpg"),
        ("Nighthawks", "Edward Hopper", "1942", "도시 밤 거리의 고독한 풍경입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Nighthawks_by_Edward_Hopper_1942.jpg/960px-Nighthawks_by_Edward_Hopper_1942.jpg"),
        ("The Gleaners", "Jean-François Millet", "1857", "들판과 농촌 풍경을 담은 작품입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Jean-Fran%C3%A7ois_Millet_-_Gleaners_-_Google_Art_Project_2.jpg/960px-Jean-Fran%C3%A7ois_Millet_-_Gleaners_-_Google_Art_Project_2.jpg"),
        ("A Sunday Afternoon on the Island of La Grande Jatte", "Georges Seurat", "1884", "강가 공원 풍경의 대표작입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/A_Sunday_on_La_Grande_Jatte%2C_Georges_Seurat%2C_1884.jpg/960px-A_Sunday_on_La_Grande_Jatte%2C_Georges_Seurat%2C_1884.jpg"),
        ("The Birth of Venus", "Sandro Botticelli", "c. 1484", "바다와 하늘을 배경으로 한 신화 풍경입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Sandro_Botticelli_-_La_nascita_di_Venere_-_Google_Art_Project_-_edited.jpg/960px-Sandro_Botticelli_-_La_nascita_di_Venere_-_Google_Art_Project_-_edited.jpg"),
        ("The Persistence of Memory", "Salvador Dalí", "1931", "초현실적 해안 풍경입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/Dargenta_%26_Salvador_Dali_The_persistance_of_Memory.png/960px-Dargenta_%26_Salvador_Dali_The_persistance_of_Memory.png"),
        ("The Swing", "Jean-Honoré Fragonard", "1767", "숲속 정원 풍경 속 장면입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/The_Swing_%28P430%29.jpg/960px-The_Swing_%28P430%29.jpg"),
        ("Dance at Le Moulin de la Galette", "Pierre-Auguste Renoir", "1876", "파리 몽마르트의 야외 풍경입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Renoir%2C_Pierre-Auguste_-_Dance_at_Le_Moulin_de_la_Galette%2C_1876.jpg/960px-Renoir%2C_Pierre-Auguste_-_Dance_at_Le_Moulin_de_la_Galette%2C_1876.jpg"),
        ("Luncheon of the Boating Party", "Pierre-Auguste Renoir", "1881", "테라스와 강가 풍경이 어우러진 작품입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Pierre-Auguste_Renoir_-_Luncheon_of_the_Boating_Party_-_Google_Art_Project.jpg/960px-Pierre-Auguste_Renoir_-_Luncheon_of_the_Boating_Party_-_Google_Art_Project.jpg"),
    ],
    "genre": [
        ("Nighthawks", "Edward Hopper", "1942", "도시 밤 카페의 일상 장면입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Nighthawks_by_Edward_Hopper_1942.jpg/960px-Nighthawks_by_Edward_Hopper_1942.jpg"),
        ("Dance at Le Moulin de la Galette", "Pierre-Auguste Renoir", "1876", "파리인의 여가와 춤을 담은 풍속화입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Renoir%2C_Pierre-Auguste_-_Dance_at_Le_Moulin_de_la_Galette%2C_1876.jpg/960px-Renoir%2C_Pierre-Auguste_-_Dance_at_Le_Moulin_de_la_Galette%2C_1876.jpg"),
        ("The Gleaners", "Jean-François Millet", "1857", "농민의 일상을 사실적으로 그린 풍속화입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Jean-Fran%C3%A7ois_Millet_-_Gleaners_-_Google_Art_Project_2.jpg/960px-Jean-Fran%C3%A7ois_Millet_-_Gleaners_-_Google_Art_Project_2.jpg"),
        ("The Card Players", "Paul Cézanne", "c. 1890", "카드 놀이하는 농민들의 일상 장면입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Les_Joueurs_de_cartes%2C_par_Paul_C%C3%A9zanne.jpg/960px-Les_Joueurs_de_cartes%2C_par_Paul_C%C3%A9zanne.jpg"),
        ("Cafe Terrace at Night", "Vincent van Gogh", "1888", "카페 테라스의 밤 풍속 장면입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Vincent-van-gogh-cafe-terrace-on-the-place-du-forum-arles-at-night-the.jpg/960px-Vincent-van-gogh-cafe-terrace-on-the-place-du-forum-arles-at-night-the.jpg"),
        ("American Gothic", "Grant Wood", "1930", "미국 중서부 농촌 가족의 풍속적 초상입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/Grant_Wood_-_American_Gothic_-_Google_Art_Project.jpg/960px-Grant_Wood_-_American_Gothic_-_Google_Art_Project.jpg"),
        ("The Night Watch", "Rembrandt", "1642", "시민 민병대의 일상적 집결 장면입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/La_ronda_de_noche%2C_por_Rembrandt_van_Rijn.jpg/960px-La_ronda_de_noche%2C_por_Rembrandt_van_Rijn.jpg"),
        ("The Arnolfini Portrait", "Jan van Eyck", "1434", "부부의 결혼·가정 생활을 기록한 실내 풍속화입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/Van_Eyck_-_Arnolfini_Portrait.jpg/960px-Van_Eyck_-_Arnolfini_Portrait.jpg"),
        ("Luncheon of the Boating Party", "Pierre-Auguste Renoir", "1881", "보트 파티의 식사 장면입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Pierre-Auguste_Renoir_-_Luncheon_of_the_Boating_Party_-_Google_Art_Project.jpg/960px-Pierre-Auguste_Renoir_-_Luncheon_of_the_Boating_Party_-_Google_Art_Project.jpg"),
        ("A Sunday Afternoon on the Island of La Grande Jatte", "Georges Seurat", "1884", "공원에서 쉬는 시민들의 풍속 장면입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/A_Sunday_on_La_Grande_Jatte%2C_Georges_Seurat%2C_1884.jpg/960px-A_Sunday_on_La_Grande_Jatte%2C_Georges_Seurat%2C_1884.jpg"),
        ("The Swing", "Jean-Honoré Fragonard", "1767", "귀족 연애의 풍속적 장면입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/The_Swing_%28P430%29.jpg/960px-The_Swing_%28P430%29.jpg"),
        ("Las Meninas", "Diego Velázquez", "1656", "궁정 일상을 담은 풍속·실내 장면입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Las_Meninas%2C_by_Diego_Vel%C3%A1zquez%2C_from_Prado_in_Google_Earth.jpg/960px-Las_Meninas%2C_by_Diego_Vel%C3%A1zquez%2C_from_Prado_in_Google_Earth.jpg"),
        ("Olympia", "Édouard Manet", "1863", "파리 현대 생활의 풍속적 인물 장면입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Edouard_Manet_-_Olympia_-_Google_Art_ProjectFXD.jpg/960px-Edouard_Manet_-_Olympia_-_Google_Art_ProjectFXD.jpg"),
        ("Christina's World", "Andrew Wyeth", "1948", "시골 생활의 고독한 순간입니다.", "https://upload.wikimedia.org/wikipedia/en/thumb/7/76/Christinasworld.jpg/960px-Christinasworld.jpg"),
        ("The Sleeping Gypsy", "Henri Rousseau", "1897", "여행자와 사막의 몽환적 풍속 장면입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/La_Boh%C3%A9mienne_endormie.jpg/960px-La_Boh%C3%A9mienne_endormie.jpg"),
        ("Impression, Sunrise", "Claude Monet", "1872", "항구 도시의 아침 풍속 풍경입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/5/59/Monet_-_Impression%2C_Sunrise.jpg/960px-Monet_-_Impression%2C_Sunrise.jpg"),
        ("The Hay Wain", "John Constable", "1821", "시골 수레와 농촌 일상입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/John_Constable_-_The_Hay_Wain_%281821%29.jpg/960px-John_Constable_-_The_Hay_Wain_%281821%29.jpg"),
        ("Girl with a Pearl Earring", "Johannes Vermeer", "c. 1665", "일상 속 한 순간을 포착한 풍속적 초상입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/1665_Girl_with_a_Pearl_Earring.jpg/960px-1665_Girl_with_a_Pearl_Earring.jpg"),
        ("The Kiss", "Gustav Klimt", "1907", "연인의 일상적이면서도 상징적인 장면입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/The_Kiss_-_Gustav_Klimt_-_Google_Cultural_Institute.jpg/960px-The_Kiss_-_Gustav_Klimt_-_Google_Cultural_Institute.jpg"),
        ("Mona Lisa", "Leonardo da Vinci", "c. 1503", "르네상스 시대 인물의 풍속적 초상입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Mona_Lisa%2C_by_Leonardo_da_Vinci%2C_from_C2RMF_retouched.jpg/960px-Mona_Lisa%2C_by_Leonardo_da_Vinci%2C_from_C2RMF_retouched.jpg"),
    ],
    "still_life": [
        ("Sunflowers", "Vincent van Gogh", "1888", "해바라기 꽃병 정물화의 대표작입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Vincent_Willem_van_Gogh_-_Sunflowers_-_VGM_F458.jpg/960px-Vincent_Willem_van_Gogh_-_Sunflowers_-_VGM_F458.jpg"),
        ("Irises", "Vincent van Gogh", "1889", "붓터치가 생생한 꽃 정물화입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Irises-Vincent_van_Gogh.jpg/960px-Irises-Vincent_van_Gogh.jpg"),
        ("Still Life with Apples", "Paul Cézanne", "1895", "사과와 천의 구도가 유명한 정물화입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Paul_C%C3%A9zanne_-_Still_life_with_apples_-_Google_Art_Project.jpg/960px-Paul_C%C3%A9zanne_-_Still_life_with_apples_-_Google_Art_Project.jpg"),
        ("The Basket of Apples", "Paul Cézanne", "1893", "과일과 병이 어우러진 정물화 걸작입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/Paul_C%C3%A9zanne_-_The_Basket_of_Apples_-_Google_Art_Project.jpg/960px-Paul_C%C3%A9zanne_-_The_Basket_of_Apples_-_Google_Art_Project.jpg"),
        ("Still Life with Skull", "Paul Cézanne", "c. 1895", "해골과 과일의 바니타스 정물화입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Paul_C%C3%A9zanne_-_Still_life_with_skull_-_Google_Art_Project.jpg/960px-Paul_C%C3%A9zanne_-_Still_life_with_skull_-_Google_Art_Project.jpg"),
        ("Still Life with Apples and Oranges", "Paul Cézanne", "c. 1899", "색면 대비가 뚜렷한 과일 정물화입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/4/42/Paul_C%C3%A9zanne_-_Still_Life_with_Apples_and_Oranges_-_Google_Art_Project.jpg/960px-Paul_C%C3%A9zanne_-_Still_Life_with_Apples_and_Oranges_-_Google_Art_Project.jpg"),
        ("Still Life with Lemons, Oranges and a Rose", "Francisco de Zurbarán", "1633", "빛과 질감이 돋보이는 스페인 정물화입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Francisco_de_Zurbar%C3%A1n_-_Still_Life_with_Lemons%2C_Oranges_and_a_Rose_-_Google_Art_Project.jpg/960px-Francisco_de_Zurbar%C3%A1n_-_Still_Life_with_Lemons%2C_Oranges_and_a_Rose_-_Google_Art_Project.jpg"),
        ("The Mound of Butter", "Jean-Baptiste-Siméon Chardin", "c. 1755", "버터와 식기의 조용한 정물화입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/Jean-Baptiste-Sim%C3%A9on_Chardin_-_The_Mound_of_Butter_-_Google_Art_Project.jpg/960px-Jean-Baptiste-Sim%C3%A9on_Chardin_-_The_Mound_of_Butter_-_Google_Art_Project.jpg"),
        ("Still Life with French Novels and Rose", "Vincent van Gogh", "1887", "책과 꽃이 놓인 탁상 정물화입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Vincent_van_Gogh_-_Still_Life_with_French_Novels_and_Rose_-_Google_Art_Project.jpg/960px-Vincent_van_Gogh_-_Still_Life_with_French_Novels_and_Rose_-_Google_Art_Project.jpg"),
        ("Still Life with Coffee Pot", "Vincent van Gogh", "1888", "커피포트와 과일의 정물화입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Vincent_van_Gogh_-_Still_Life_with_Coffee_Pot_-_Google_Art_Project.jpg/960px-Vincent_van_Gogh_-_Still_Life_with_Coffee_Pot_-_Google_Art_Project.jpg"),
        ("Still Life with Cabbage and Clogs", "Vincent van Gogh", "1881", "초기 정물화로 소박한 사물을 담았습니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Vincent_van_Gogh_-_Still_life_with_cabbage_and_clogs_-_Google_Art_Project.jpg/960px-Vincent_van_Gogh_-_Still_life_with_cabbage_and_clogs_-_Google_Art_Project.jpg"),
        ("Chrysanthemums", "Claude Monet", "1882", "국화 꽃병 정물화입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dc/Claude_Monet_-_Chrysanthemums_-_Google_Art_Project.jpg/960px-Claude_Monet_-_Chrysanthemums_-_Google_Art_Project.jpg"),
        ("Still Life with Flowers and Fruit", "Henri Fantin-Latour", "1865", "꽃과 과일의 고전적 정물화입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Henri_Fantin-Latour_-_Still_Life_with_Flowers_and_Fruit_-_Google_Art_Project.jpg/960px-Henri_Fantin-Latour_-_Still_Life_with_Flowers_and_Fruit_-_Google_Art_Project.jpg"),
        ("Still Life with Geranium", "Henri Matisse", "1910", "선과 색으로 단순화한 정물화입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Henri_Matisse_-_Still_Life_with_Geranium_-_Google_Art_Project.jpg/960px-Henri_Matisse_-_Still_Life_with_Geranium_-_Google_Art_Project.jpg"),
        ("Still Life with Sunflowers on an Armchair", "Paul Gauguin", "1901", "해바라기와 가구의 정물 구성입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Paul_Gauguin_-_Still_Life_with_Sunflowers_on_an_Armchair_-_Google_Art_Project.jpg/960px-Paul_Gauguin_-_Still_Life_with_Sunflowers_on_an_Armchair_-_Google_Art_Project.jpg"),
        ("Still Life with Fruit and Ham", "Jan Davidsz. de Heem", "c. 1650", "풍성한 식탁 정물화의 바로크 걸작입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/Jan_Davidsz._de_Heem_-_Still-Life_with_Fruit_and_Ham_-_Google_Art_Project.jpg/960px-Jan_Davidsz._de_Heem_-_Still-Life_with_Fruit_and_Ham_-_Google_Art_Project.jpg"),
        ("Still Life with Melon and Peaches", "Luis Meléndez", "c. 1770", "스페인 과일 정물화의 대표작입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Luis_Mel%C3%A9ndez_-_Still_Life_with_Melon_and_Peaches_-_Google_Art_Project.jpg/960px-Luis_Mel%C3%A9ndez_-_Still_Life_with_Melon_and_Peaches_-_Google_Art_Project.jpg"),
        ("Flower Still Life", "Rachel Ruysch", "c. 1710", "정교한 꽃 정물화입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f0/Rachel_Ruysch_-_Flower_Still-Life_-_Google_Art_Project.jpg/960px-Rachel_Ruysch_-_Flower_Still-Life_-_Google_Art_Project.jpg"),
        ("Still Life with Oysters", "Willem Claesz. Heda", "1635", "굴과 은식기의 정밀 정물화입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Willem_Claesz._Heda_-_Still_Life_with_Oysters_-_Google_Art_Project.jpg/960px-Willem_Claesz._Heda_-_Still_Life_with_Oysters_-_Google_Art_Project.jpg"),
        ("Campbell's Soup Cans", "Andy Warhol", "1962", "현대 정물·팝아트의 상징적 연작입니다.", "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Campbell%27s_Soup_Cans_by_Andy_Warhol.jpg/960px-Campbell%27s_Soup_Cans_by_Andy_Warhol.jpg"),
    ],
}


def genre_work_limit(genre_id: str, *, masterpiece: bool = False) -> int:
    return MASTERPIECE_WORK_TARGET if masterpiece or genre_id == "masterpiece" else GENRE_WORK_TARGET


def build_curated_genre_works(
    genre_id: str,
    limit: int,
    *,
    base_work_fn: Any,
    downsize_fn: Any,
) -> list[dict[str, Any]]:
    curated = GENRE_CURATED_ENTRIES.get(genre_id) or []
    works: list[dict[str, Any]] = []
    for idx, (title, artist, date, desc, url) in enumerate(curated[:limit], start=1):
        if not url:
            continue
        work = base_work_fn(idx, title, artist, date, desc)
        work["id"] = f"genre-cdn:{genre_id}:{idx:02d}"
        work["source"] = "cdn"
        small = downsize_fn(url, 330)
        work["preview_url"] = url
        work["thumb_url"] = small
        work["image_url"] = url
        work["direct_preview_url"] = url
        work["direct_thumb_url"] = small
        work["direct_image_url"] = url
        works.append(work)
    return works
