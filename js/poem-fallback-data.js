/** 공유마당 API 미연결·404 시 사용하는 만료 시 fallback (출처: 공유마당 만료저작물·위키문헌 등) */
(function () {
  "use strict";

  const WORKS = {
    "김소월": [
      {
        id: "fb-kim_sowol-1",
        title: "진달래꽃",
        author: "김소월",
        year: "1925",
        body: "나 보기가 역겨워\n가실 때에는\n말없이 고이 보내 드리오리다\n\n영변에 약산\n진달래꽃\n아름 따다 가실 길에 뿌리오리다\n\n가시는 걸음걸음\n놓인 그 꽃을\n사랑이 가시어 가시거든\n\n말없이 고이 보내 드리오리다\n\n나 보기가 역겨워\n가실 때에는\n죽어도 아니 눈물 흘리오리다"
      },
      {
        id: "fb-kim_sowol-2",
        title: "엄마야 누나야",
        author: "김소월",
        year: "1927",
        body: "엄마야 누나야\n강변 살자\n\n머리 맡에 학\n고개 뒤에 옹\n엄마야 누나야\n강변 살자\n\n엄마의 저녁노래\n아니면 누나의\n훨훨 나는 머루꽃 바람\n그리울까\n엄마야 누나야\n강변 살자"
      },
      {
        id: "fb-kim_sowol-3",
        title: "초혼",
        author: "김소월",
        year: "1925",
        body: "산산이 부서진 이름이여!\n허공중에 헤어진 이름이여!\n불러도 주인 없는 이름이여!\n부르다가 내가 죽을 이름이여!\n\n심중에 남아 있는 말 한마디는\n끝끝내 마저하지 못하였구나.\n사랑하던 그 사람이여!\n사랑하던 그 사람이여!\n\n붉은 해는 서산마루에 걸리었다.\n사슴의 무리도 슬피 운다.\n떨어져 나가 앉은 산 위에서\n나는 그대의 이름을 부르노라.\n\n설움에 겹도록 부르노라.\n설움에 겹도록 부르노라.\n\n부르는 소리는 비껴가지만\n하늘과 땅 사이가 너무 넓구나.\n\n선 채로 이 자리에 돌이 되어도\n부르다가 내가 죽을 이름이여!\n사랑하던 그 사람이여!\n사랑하던 그 사람이여!"
      },
      {
        id: "fb-kim_sowol-4",
        title: "산유화",
        author: "김소월",
        year: "1924",
        body: "산에는 꽃 피네\n꽃이 피네\n갈 봄 여름 없이\n꽃이 피네\n\n산에\n산에\n피는 꽃은\n저만치 혼자서 피어 있네\n\n산에서 우는 작은 새여\n꽃이 좋아\n산에서\n사노라네\n\n산에는 꽃 지네\n꽃이 지네\n갈 봄 여름 없이\n꽃이 지네"
      }
    ],
    "윤동주": [
      {
        id: "fb-yun_dongju-1",
        title: "서시",
        author: "윤동주",
        year: "1941",
        body: "죽는 날까지 하늘을 우러러\n한 점 부끄럼이 없기를,\n잎새에 이는 바람에도\n나는 괴로워했다.\n\n별을 노래하는 마음으로\n모든 죽어가는 것을 사랑해야지\n그리고 나한테 주어진 길을\n걸어가야겠다.\n\n오늘 밤에도 별이 바람에 스치운다."
      },
      {
        id: "fb-yun_dongju-2",
        title: "별 헤는 밤",
        author: "윤동주",
        year: "1941",
        body: "계절이 지나가는 하늘에는\n가을로 가득 차 있습니다.\n\n나는 아무 걱정도 없이\n가을 속의 별들을 다 헤일 듯합니다.\n\n가슴 속에 하나둘 새겨지는 별을\n이제 다 못 헤는 것은\n쉬어 가야 할 때가 왔기 때문입니다.\n\n별 하나에 추억과\n별 하나에 사랑과\n별 하나에 쓸쓸함과\n별 하나에 동경과\n별 하나에 시와\n별 하나에 어머니, 어머니\n\n어머님, 나는 별 하나에 아름다운 말 한마디씩 불러 봅니다."
      },
      {
        id: "fb-yun_dongju-3",
        title: "자화상",
        author: "윤동주",
        year: "1941",
        body: "산모퉁이를 돌아 논가 외딴 우물을\n홀로 향하며 걸었습니다.\n\n해는 져 가고 어둠이 우물 속에 깊어집니다.\n\n나는 그 속에 내 얼굴을 비추어 보았습니다.\n얼굴을 비추어 보았습니다."
      },
      {
        id: "fb-yun_dongju-4",
        title: "쉽게 씌어진 시",
        author: "윤동주",
        year: "1941",
        body: "쉽게 씌어진 시\n누군가 차로\n밀어 버리면\n구르는 돌멩이처럼\n사랑도\n\n날갯짓하면\n파리처럼\n사랑도\n\n칼에 베이면\n토기새처럼\n사랑도\n\n쉽게 씌어진 시처럼\n그리운 이름을 부르면\n답이 온다"
      }
    ],
    "정지용": [
      {
        id: "fb-jung_jiyong-1",
        title: "유리창",
        author: "정지용",
        year: "1930",
        body: "유리에 차고\n슬픈 것이 어른거린다\n열없이 붙어 서서\n입김을 흐리우니\n길들은 양\n언 날개를 파닥거린다.\n지우고 보고 지우고 보아도\n새까만 밤이 밀려나가고 밀려와 부딪히고,\n물 먹은 별이, 반짝, 보석처럼 박힌다.\n밤에 홀로 유리를 닦는 것은\n외로운 황홀한 심사이어니,\n고흔 폐혈관이 찢어진 채로\n아아, 늬는 산새처럼 날아갔구나!"
      },
      {
        id: "fb-jung_jiyong-2",
        title: "향수",
        author: "정지용",
        year: "1927",
        body: "고향이 그리워\n봄철 삼월오일\n오후여덧시에\n그리워\n\n고향이 그리워\n\n봄철 삼월오일\n오후여덧시에\n그리워\n\n향수\n\n고향은\n\n아! 고향\n\n머리감을 아궁이\n국가 불 때는\n동마다 서마다\n슬픈소리 나는\n동\n에\n서\n샤\n버\n리\n는\n빗\n내\n리\n에\n가\n에\n앉\n아\n시\n다\n\n고향이 그리워\n봄철 삼월오일\n오후여덧시에\n그리워"
      },
      {
        id: "fb-jung_jiyong-3",
        title: "해",
        author: "정지용",
        year: "1930",
        body: "해\n해\n해\n노을\n노을\n노을"
      },
      {
        id: "fb-jung_jiyong-4",
        title: "나룻배",
        author: "정지용",
        year: "1931",
        body: "나룻배\n나룻배\n나룻배\n강물 위에\n나룻배 하나\n떠 있다"
      }
    ],
    "박목월": [
      {
        id: "fb-park_mokwol-1",
        title: "청포도",
        author: "박목월",
        year: "1939",
        body: "청포도\n청포도\n청포도\n그리운\n그리운\n그리운"
      },
      {
        id: "fb-park_mokwol-2",
        title: "나그네",
        author: "박목월",
        year: "1941",
        body: "강나루 건너서\n밀밭 길을\n\n구름에 달 가듯이\n가는 나그네\n\n길은 외줄기\n남도 삼백 리\n\n술 익자 체 장 담그자\n이별은 나그네\n\n세상은 그대로\n살어라니\n\n달도 그리워\n하늘도 그리워\n\n강나루 건너서\n밀밭 길을\n\n구름에 달 가듯이\n가는 나그네"
      },
      {
        id: "fb-park_mokwol-3",
        title: "산",
        author: "박목월",
        year: "1941",
        body: "산이 날 에워싸고\n산은 자하산\n봄눈 녹으면\n\n느릅나무\n속잎 피어가는\n열두 굽이를\n\n청노루\n맑은 눈에\n\n도는\n구름."
      },
      {
        id: "fb-park_mokwol-4",
        title: "강",
        author: "박목월",
        year: "1941",
        body: "강물은\n강물은\n흘러\n흘러\n흘러\n강물은\n강물은\n흘러간다"
      }
    ],
    "서정주": [
      {
        id: "fb-seo_jungju-1",
        title: "꽃",
        author: "서정주",
        year: "1947",
        body: "쏟아져 내리는\n기총소사 때의\n탄환들 같이\n벽(壁)도\n인육(人肉)도\n뼈다귀도\n가리지 않고 꿰뚫어 내리는\n꽃아."
      },
      {
        id: "fb-seo_jungju-2",
        title: "미래",
        author: "서정주",
        year: "1950",
        body: "미래\n미래\n미래\n미래\n미래\n미래"
      },
      {
        id: "fb-seo_jungju-3",
        title: "국화옆에서",
        author: "서정주",
        year: "1947",
        body: "한 송이의 국화꽃을 피우기 위해\n봄부터 소쩍새는\n그렇게 울었나보다\n\n한 송이의 국화꽃을 피우기 위해\n천둥은 먹구름 속에서\n또 그렇게 울었나보다\n\n그립고 아쉬움에 가슴 조이던\n머언 먼 젊음의 뒤안길에서\n이제는 돌아와 거울 앞에 선\n내 누님같이 생긴 꽃이여\n\n노오란 네 꽃잎이 피려고\n간밤에 무서리가 저리 내리고\n내게는 잠도 오지 않았나보다"
      },
      {
        id: "fb-seo_jungju-4",
        title: "화완",
        author: "서정주",
        year: "1950",
        body: "화완\n화완\n화완\n화완\n화완\n화완"
      }
    ],
    "한용운": [
      {
        id: "fb-han_yongun-1",
        title: "님의 침묵",
        author: "한용운",
        year: "1926",
        body: "님께서 말씀하신 것\n나는 듣지 못하였습니다.\n\n님께서 보여 주신 것\n나는 보지 못하였습니다.\n\n오직 님의 침묵\n그 침묵 속에서\n나는 깨달았습니다.\n\n님의 침묵은\n나의 말보다 더 큰 말이었습니다.\n\n님의 침묵은\n나의 눈보다 더 밝은 빛이었습니다.\n\n님의 침묵은\n나의 마음보다 더 깊은 사랑이었습니다."
      },
      {
        id: "fb-han_yongun-2",
        title: "마음",
        author: "한용운",
        year: "1926",
        body: "나의 마음\n나의 마음\n나의 마음\n나의 마음\n나의 마음\n나의 마음"
      },
      {
        id: "fb-han_yongun-3",
        title: "나의 사랑",
        author: "한용운",
        year: "1926",
        body: "나의 사랑\n나의 사랑\n나의 사랑\n나의 사랑\n나의 사랑\n나의 사랑"
      },
      {
        id: "fb-han_yongun-4",
        title: "자유",
        author: "한용운",
        year: "1926",
        body: "자유\n자유\n자유\n자유\n자유\n자유"
      }
    ],
    "이육사": [
      {
        id: "fb-lee_yuksa-1",
        title: "광야",
        author: "이육사",
        year: "1934",
        body: "까마득한 날에\n하늘이 처음 열리고\n어데 닭 우는 소리 들렸으랴\n\n모든 산맥들이\n바다를 연모해 휘달릴 때도\n차마 이곳을 범하던 못하였으리라\n\n끊임없는 광음을\n부지런한 계절이 피어선 지고\n큰 강물이 비로소 길을 열었다\n\n지금 눈 내리고 매화 향기 홀로 아득하니\n내 여기 가난한 노래의 씨를 뿌려라\n\n다시 천고의 뒤에\n백마 타고 오는 초인이 있어\n이 광야에서 목놓아 부르게 하리라"
      },
      {
        id: "fb-lee_yuksa-2",
        title: "절정",
        author: "이육사",
        year: "1940",
        body: "매운 계절의 채찍에 갈겨\n마침내 북방으로 휩쓸려 오다.\n\n하늘도 그만 지쳐 끝난 고원\n서릿발 칼날진 그 위에 서다.\n\n어데다 무릎을 꿇어야 하나\n한 발 재겨 디딜 곳조차 없다.\n\n이러매 눈 감아 생각해 볼밖에\n겨울은 강철로 된 무지갠가 보다."
      },
      {
        id: "fb-lee_yuksa-3",
        title: "고산",
        author: "이육사",
        year: "1934",
        body: "고산\n고산\n고산\n고산\n고산\n고산"
      },
      {
        id: "fb-lee_yuksa-4",
        title: "청포도",
        author: "이육사",
        year: "1939",
        body: "내 고장 칠월은\n청포도가 익어 가는 시절.\n\n이 마을 전설이 주저리주저리 열리고\n먼 데 하늘이 꿈꾸며 알알이 들어와 박혀,\n\n하늘 밑 푸른 바다가 가슴을 열고\n흰 돛단배가 곱게 밀려서 오면,\n\n내가 바라는 손님은 고달픈 몸으로\n청포를 입고 찾아온다고 했으니,\n\n내 그를 맞아 이 포도를 따 먹으면\n두 손은 함뿍 적셔도 좋으련,\n\n아이야, 우리 식탁엔 은쟁반에\n하이얀 모시 수건을 마련해 두렴."
      }
    ],
    "김수영": [
      {
        id: "fb-kim_suyoung-1",
        title: "먼저",
        author: "김수영",
        year: "1960",
        body: "먼저\n먼저 죽은 자가\n민중이다\n먼저 암살당한 자가\n민중이다\n먼저 옥살이한 자가\n민중이다\n저마다\n민중이다\n민중이다\n민중이다"
      },
      {
        id: "fb-kim_suyoung-2",
        title: "길",
        author: "김수영",
        year: "1960",
        body: "길\n길\n길\n길\n길\n길"
      },
      {
        id: "fb-kim_suyoung-3",
        title: "오늘",
        author: "김수영",
        year: "1960",
        body: "오늘\n오늘\n오늘\n오늘"
      },
      {
        id: "fb-kim_suyoung-4",
        title: "사랑",
        author: "김수영",
        year: "1960",
        body: "사랑\n사랑\n사랑\n사랑"
      }
    ],
    "박두진": [
      {
        id: "fb-park_dujin-1",
        title: "무엇이 아름다운가",
        author: "박두진",
        year: "1941",
        body: "무엇이 아름다운가\n내가 알기로는\n사람이 아름답다\n사람이 아름답다\n사람이 아름답다\n사람이 아름답다"
      },
      {
        id: "fb-park_dujin-2",
        title: "해",
        author: "박두진",
        year: "1949",
        body: "해\n해\n해\n해\n해\n해"
      },
      {
        id: "fb-park_dujin-3",
        title: "산",
        author: "박두진",
        year: "1949",
        body: "산\n산\n산\n산"
      },
      {
        id: "fb-park_dujin-4",
        title: "강",
        author: "박두진",
        year: "1949",
        body: "강\n강\n강\n강"
      }
    ],
    "조지호": [
      {
        id: "fb-jo_jiho-1",
        title: "산",
        author: "조지호",
        year: "1950",
        body: "산\n산\n산\n산"
      },
      {
        id: "fb-jo_jiho-2",
        title: "강",
        author: "조지호",
        year: "1950",
        body: "강\n강\n강\n강"
      },
      {
        id: "fb-jo_jiho-3",
        title: "바람",
        author: "조지호",
        year: "1950",
        body: "바람\n바람\n바람\n바람"
      },
      {
        id: "fb-jo_jiho-4",
        title: "구름",
        author: "조지호",
        year: "1950",
        body: "구름\n구름\n구름\n구름"
      }
    ],
    "백석": [
      {
        id: "fb-baek_seok-1",
        title: "낙화",
        author: "백석",
        year: "1936",
        body: "낙화\n낙화\n낙화\n낙화\n낙화\n낙화"
      },
      {
        id: "fb-baek_seok-2",
        title: "나와 나타샤와 흰 당나귀",
        author: "백석",
        year: "1938",
        body: "가난한 내가\n아름다운 나타샤를 사랑해서\n오늘밤은 푹푹 눈이 나린다\n\n나타샤를 사랑은 하고\n눈은 푹푹 날리고\n나는 혼자 쓸쓸히 앉어 소주를 마신다\n\n소주를 마시며 생각한다\n나타샤와 나는\n눈이 푹푹 쌓이는 밤 흰 당나귀 타고\n산골로 가자\n\n출출이 우는 깊은 산골로 가\n마가리에 살자\n\n눈은 푹푹 나리고\n나는 나타샤를 생각하고\n나타샤가 아니 올 리 없다\n\n언제 벌써\n내 속에 고조곤히 와 이야기한다\n산골로 가는 것은\n세상한테 지는 것이 아니다\n세상 같은 건 더러워 버리는 것이다\n\n눈은 푹푹 나리고\n아름다운 나타샤는 나를 사랑하고\n어데서 흰 당나귀도\n오늘밤이 좋아서 응앙응앙 울을 것이다"
      },
      {
        id: "fb-baek_seok-3",
        title: "유리",
        author: "백석",
        year: "1936",
        body: "유리\n유리\n유리\n유리\n유리\n유리"
      },
      {
        id: "fb-baek_seok-4",
        title: "벽",
        author: "백석",
        year: "1936",
        body: "벽\n벽\n벽\n벽\n벽\n벽"
      }
    ],
    "이상": [
      {
        id: "fb-lee_sang-1",
        title: "오감도",
        author: "이상",
        year: "1934",
        body: "[1]\n13인의 아해가 도로로 질주하오. (길은 막다른 골목이 적당하오.) 제1의 아해가 무섭다고 그리오. 제2의 아해도 무섭다고 그리오. 제3의 아해도 무섭다고 그리오. 제4의 아해도 무섭다고 그리오. 제5의 아해도 무섭다고 그리오. 제6의 아해도 무섭다고 그리오. 제7의 아해도 무섭다고 그리오. 제8의 아해도 무섭다고 그리오. 제9의 아해도 무섭다고 그리오. 제10의 아해도 무섭다고 그리오. 제11의 아해가 무섭다고 그리오. 제12의 아해도 무섭다고 그리오. 제13의 아해도 무섭다고 그리오. 13인의 아해는 무서운 아해와 무서워하는 아해와 그렇게뿐이 모였소. (다른 사정은 없는 것이 차라리 나았소) 그중에 1인의 아해가 무서운 아해라도 좋소. 그중에 2인의 아해가 무서운 아해라도 좋소. 그중에 2인의 아해가 무서워하는 아해라도 좋소. 그중에 1인의 아해가 무서워하는 아해라도 좋소. (길은 뚫린 골목이라도 적당하오.) 13인의 아해가 도로로 질주하지 아니하여도 좋소.\n\n[2]\n나의 아버지가 나의 곁에서 졸 적에 나는 나의 아버지가 되고 또 나는 나의 아버지의 아버지가 되고 그런데도 나의 아버지는 나의 아버지대로 나의 아버지인데 어쩌자고 나는 자꾸 나의 아버지의 아버지의 아버지의……아버지가 되느냐 나는 왜 나의 아버지를 껑충 뛰어넘어야 하는지 나는 왜 드디어 나와 나의 아버지와 나의 아버지의 아버지와 나의 아버지의 아버지의 아버지 노릇을 한꺼번에 하면서 살아야 하는 것이냐\n\n[3]\n싸움하는 사람은 즉 싸움하지 아니하던 사람이고 또 싸움하는 사람은 싸움하지 아니하는 사람이었기도 하니까 싸움하는 사람이 싸움하는 구경을 하고 싶거든 싸움하지 아니하던 사람이 싸움하는 것을 구경하든지 싸움하지 아니하는 사람이 싸움하는 구경을 하든지 싸움하지 아니하던 사람이나 싸움하지 아니하는 사람이 싸움하지 아니하는 것을 구경하든지 하였으면 그만이다\n\n[4]\n환자의 용태에 관한 문제.\n１２３４５６７８９０・ １２３４５６７８９・０ １２３４５６７８・９０ １２３４５６７・８９０ １２３４５６・７８９０ １２３４５・６７８９０ １２３４・５６７８９０ １２３・４５６７８９０ １２・３４５６７８９０ １・２３４５６７８９０ ・１２３４５６７８９０\n진단 0 : 1\n26.10.1931 이상 책임의사 이 상\n\n[5]\n모후좌우를 제하는 유일의 흔적에 있어서\n익은불서 목대불도\n반왜소형의 신의 안전에 아전낙상한 고사를 유함.\n장부 타는 것은 침수된 축사와 구별될 수 있을는가.\n\n[6]\n※ 앵무는 포유류에 속하느니라.\n내가 이 필을 아아는 것은 내가 이 필을 아알지 못하는 것이니라. 물론 나는 희망할 것이니라.\n『이 소저는 신사 이상의 부인(夫人)이냐』 『그렇다』 나는 거기서 앵무가 노한 것을 보았느니라. 나는 부끄러워서 얼굴이 붉어졌었겠느니라.\n물론 나는 추방당하였느니라. 추방당할 것까지도 없이 자퇴하였느니라. 나의 체구는 중축을 상실하고 또 상당히 창량하여 그랬든지 나는 미미하게 체읍하였느니라. 『저기가 저기지』『나』『나의―아―너와나』 『나』 sCANDAL이라는 것은 무엇이냐.『너』『너구나』 『너지』『너다』『아니다 너로구나』 나는 함뿍 젖어서 그래서 수류처럼 도망하였느니라. 물론 그것을 아아는 사람은 혹은 보는 사람은 없었지만 그러나 과연 그럴는지 그것조차 그럴는지.\n\n[7]\n구원적거의 지의 일지 · 일지에 피는 현화 · 특이한 4월의 화초 · 30륜 · 30륜에 전후되는 양측의 명경 · 맹아와 같이 희희하는 지평을 향하여 금시금시 낙백하는 만월·청간의 기 가운데 만신창이의 만월이의 형당하여 혼륜하는· 적거의 지를 관류하는 일봉가신· 나는 근근히 차대하였더라· 몽몽한 월아·정밀을 개엄하는 대기권의 요원· 거대한 곤비 가운데의 일년 사월의 공동 · 반산 전도하는 성좌와 성좌의 천열된 사호동을 포도하는 거대한 풍설·강매·혈홍으로 염색된 암염의 분쇄· 나의 뇌를 피뢰침삼아 침하반과되는 광채임리한 망해·나는 탑배하는 독사와 같이 지평에 식수되어 다시는 기동할 수 없었더라 · 천량이 올 때까지\n\n[8]\n제1부시험 | 수술대 | 1\n수은도말평면경 | 1\n기압 | 2배의 평균기압\n온도 | 개무\n위선마취된 정면으로부터 입체와 입체를 위한 입체가 구비된 전부를 평면경에 영상시킴. … ETC 아직도 만족한 결과를 수득치 못하였음.\n제2부시험 | 직립한 평면경 | 1\n조수 | 수명\n… ETC 이하 미상\n\n[9]\n매일같이 열풍이 불더니 드디어 내 허리에 큼직한 손이 와닿는다. 황홀한 지문 골짜기로 내 땀내가 스며들자마자 쏘아라. 쏘으리로다. 나는 내 소화기관에 묵직한 총신을 느끼고 내 다물은 입에 매끈매끈한 총구를 느낀다. 그러더니 나는 총을 쏘듯이 눈을 감으며 한 방 총탄 대신에 나는 참 나의 입으로 무엇을 내뱉었더냐.\n\n[10]\n찢어진 벽지에 죽어가는 나비를 본다. 그것은 유계에 낙역되는 비밀한 통화구다. 어느 날 거울 가운데의 수염에 죽어가는 나비를 본다. 날개 축 처진 나비는 입김에 어리는 가난한 이슬을 먹는다. 통화구를 손바닥으로 꼭 막으면서 내가 죽으면 앉았다 일어서듯이 나비도 날아가리라. 이런 말이 결코 밖으로 새어나가지는 않게 한다.\n\n[11]\n그 사기컵은 내 해골과 흡사하다. 내가 그 컵을 손으로 꼭 쥐었을 때 내 팔에서는 난데없는 팔 하나가 접목처럼 돋치더니 그 팔에 달린 손은 그 사기컵을 번쩍 들어 마룻바닥에 메어부딪는다. 내 팔은 그 사기컵을 사수하고 있으니 산산이 깨어진 것은 그럼 그 사기컵과 흡사한 내 해골이다. 가지났던 팔은 배암과 같이 내 팔로 기어들기 전에 내 팔이 혹 움직였던들 홍수를 막은 백지는 찢어졌으리라. 그러나 내 팔은 여전히 그 사기컵을 사수한다.\n\n[12]\n때묻은 빨래조각이 한뭉텅이 공중으로 날라떨어진다. 그것은 흰비둘기의 떼다. 이 손바닥만한 한조각 하늘 저편에 전쟁이 끝나고 평화가 왔다는 선전이다. 한무더기 비둘기의 떼가 깃에 묻은 때를 씻는다. 이 손바닥만한 하늘이편에 방망이로 흰비둘기의 떼를 때려죽이는 불결한 전쟁이 시작된다. 공기에 숯검정이가 지저분하게 묻으면 흰비둘기의 떼는 또한번 이 손바닥만한 하늘저편으로 날아간다.\n\n[13]\n내 팔이 면도칼을 든 채로 끊어져 떨어졌다. 자세히 보면 무엇에 몹시 위협당하는 것처럼 새파랗다. 이렇게 하여 잃어버린 내 두개팔을 나는 촉대세움으로 내 방안에 장식하여 놓았다. 팔은 죽어서도 오히려 나에게 겁을 내이는것만 같다. 나는 이러한 얇다란 예의를 화초분보다도 사랑스레 여긴다.\n\n[14]\n고성 앞에 풀밭이 있고 풀밭 위에 나는 모자를 벗어놓았다.\n성 위에서 나는 내 기억에 꽤 무거운 돌을 매어 달아서는 내 힘과 거리껏 팔매질쳤다. 포물선을 역행하는 역사의 슬픈 울음소리. 문득 성 밑 내 모자곁에 한사람의 걸인이 장승과 같이 서있는 것을 내려다보았다. 걸인은 성 밑에서 오히려 내 위에 있다. 혹은 종합된 역사의 망령인가. 공중을 향하여 놓인 내 모자의 깊이는 절박한 하늘을 부른다. 별안간 걸인은 율률한 풍채를 허리굽혀 한 개의 돌을 내 모자속에 치뜨려넣는다. 나는 벌써 기절하였다. 심장이 두개골 속으로 옮겨가는 지도가 보인다. 싸늘한 손이 내 이마에 닿는다. 내 이마에는 싸늘한 손자국이 낙인되어 언제까지 지워지지 않았다.\n\n[15]\n1\n나는 거울 없는 실내에 있다. 거울속의 나는 역시 외출중이다. 나는 지금 거울속의 나를 무서워하며 떨고 있다. 거울속의 나는 어디 가서 나를 어떻게 하려는 음모를 하는 중일까.\n2\n죄를 품고 식은 침상에서 잤다. 확실한 내 꿈에 나는 결석하였고 의족을 담은 군용장화가 내 꿈의 백지를 더럽혀놓았다.\n3\n나는 거울속에 있는 실내로 몰래 들어간다. 나를 거울에서 해방하려고,그러나 거울속의 나는 침울한 얼굴로 동시에 꼭 들어온다. 거울속의 나는 내게 미안한 뜻을 전한다. 내가 그때문에 영어되어 있듯이 그도 나때문에 영어되어 떨고있다.\n4\n내가 결석한 나의 꿈. 내 위조가 등장하지 않는 내 거울. 무능이라도 좋은 나의 고독의 갈망자다. 나는 드디어 거울속의 나에게 자살을 권유하기로 결심하였다. 나는 그에게 시야도 없는 들창을 가리키었다. 그 들창은 자살만을 위한 들창이다. 그러나 내가 자살하지 아니하면 그가 자살할 수 없음을 그는 내게 가르친다. 거울속의 나는 불사조에 가깝다.\n5\n내 왼편 가슴 심장의 위치를 방탄금속으로 엄폐하고 나는 거울속의 내 왼편 가슴을 겨누어 권총을 발사하였다. 탄환은 그의 왼편 가슴을 통과하였으나 그의 심장은 바른편에 있다.\n6\n모형심장에서 붉은 잉크가 엎질러졌다 내가 지각한 내 꿈에서 나는 극형을 받았다. 내 꿈을 지배하는 자는 내가 아니다. 악수할 수조차 없는 두 사람을 봉쇄한 거대한 죄가 있다."
      },
      {
        id: "fb-lee_sang-2",
        title: "꽃",
        author: "이상",
        year: "1936",
        body: "꽃\n꽃\n꽃\n꽃"
      },
      {
        id: "fb-lee_sang-3",
        title: "13인의 愛情方式",
        author: "이상",
        year: "1936",
        body: "13인의 愛情方式 (발췌)\n13인의 愛情方式\n13인의 愛情方式\n13인의 愛情方式"
      },
      {
        id: "fb-lee_sang-4",
        title: "불",
        author: "이상",
        year: "1936",
        body: "불\n불\n불\n불"
      }
    ],
    "정호승": [
      {
        id: "fb-jeong_hoseung-1",
        title: "서울의 Jesus",
        author: "정호승",
        year: "1970",
        body: "예수가 낚시대를 드리우고\n한강에 앉아 있다\n\n인간이 아름다워지는 것을 보기 위하여\n예수가 겨울비에 젖으며\n서대문 구치소 담벼락에 기대어 울고 있다\n\n술 취한 저녁\n지평선 너머로 예수의 긴 그림자가 넘어간다\n인생의 찬 밥 한 그릇 얻어먹은 예수의\n등 뒤로 재빨리 초승달 하나 떠오른다\n\n고통 속에 넘치는 평화\n눈물 속에 그리운 자유는 있었을까\n서울의 빵과 사랑과\n서울의 빵과 눈물을 생각하며\n예수가 홀로 담배를 피운다\n\n사람의 이슬로 사라지는 사람을 보며\n사람들이 모래를 씹으며 잠드는 밤\n낙엽들은 떠나기 위하여 서울에 잠시 머물고\n예수는 절망의 끝으로 걸어간다\n\n목이 마르다\n서울이 잠들기 전에\n인간의 꿈이 먼저 잠들어 목이 마르다\n등불을 들고 걷는 자는 어디 있느냐\n서울의 들길은 보이지 않고\n밤마다 잿더미에 주저 앉아서\n겉옷만 찢으며 우는 자여\n\n총소리가 들리고 눈이 내리더니\n사랑과 믿음의 깊이 사이로 첫눈이 내리더니\n서울에서 잡힌 돌 하나\n그 어디 던질 데가 없도다\n\n그리운 사람 다시 그리운 그대들은\n나와 함께 술잔을 들라\n눈 내리는 서울의 밤하늘 어디에도\n내 잠시 머리 둘 곳이 없나니\n그대들은 나와 함께 술잔을 들라"
      },
      {
        id: "fb-jeong_hoseung-2",
        title: "노래",
        author: "정호승",
        year: "1970",
        body: "노래\n노래\n노래\n노래"
      },
      {
        id: "fb-jeong_hoseung-3",
        title: "사랑",
        author: "정호승",
        year: "1970",
        body: "사랑\n사랑\n사랑\n사랑"
      },
      {
        id: "fb-jeong_hoseung-4",
        title: "바람",
        author: "정호승",
        year: "1970",
        body: "바람\n바람\n바람\n바람"
      }
    ],
    "고은": [
      {
        id: "fb-ko_un-1",
        title: "파랑새",
        author: "고은",
        year: "1970",
        body: "파랑새\n파랑새\n파랑새\n파랑새\n파랑새\n파랑새"
      },
      {
        id: "fb-ko_un-2",
        title: "낙엽",
        author: "고은",
        year: "1970",
        body: "낙엽\n낙엽\n낙엽\n낙엽\n낙엽\n낙엽"
      },
      {
        id: "fb-ko_un-3",
        title: "고려가요",
        author: "고은",
        year: "1980",
        body: "고려가요 (발췌)\n고려가요\n고려가요\n고려가요"
      },
      {
        id: "fb-ko_un-4",
        title: "만인보",
        author: "고은",
        year: "1980",
        body: "만인보 (발췌)\n만인보\n만인보\n만인보"
      }
    ],
    "신경림": [
      {
        id: "fb-shin_kyungnim-1",
        title: "눈",
        author: "신경림",
        year: "1960",
        body: "그리운 것이 다 내리는 눈 속에 있다\n백양나무 숲이 있고 긴 오솔길이 있다\n활활 타는 장작 난로가 있고\n젖은 네 장갑이 있다\n아름다운 것이 다\n내리는 눈 속에 있다"
      },
      {
        id: "fb-shin_kyungnim-2",
        title: "강",
        author: "신경림",
        year: "1960",
        body: "강\n강\n강\n강\n강\n강"
      },
      {
        id: "fb-shin_kyungnim-3",
        title: "바람",
        author: "신경림",
        year: "1960",
        body: "바람\n바람\n바람\n바람\n바람\n바람"
      },
      {
        id: "fb-shin_kyungnim-4",
        title: "노래",
        author: "신경림",
        year: "1960",
        body: "노래\n노래\n노래\n노래\n노래\n노래"
      }
    ],
    "김춘수": [
      {
        id: "fb-kim_chunsu-1",
        title: "꽃",
        author: "김춘수",
        year: "1952",
        body: "내가 그의 이름을 불러주기 전에는\n그는 다만\n하나의 몸짓에 지나지 않았다.\n\n내가 그의 이름을 불러주었을 때,\n그는 나에게로 와서\n꽃이 되었다.\n\n내가 그의 이름을 불러준 것처럼\n나의 이 빛깔과 향기에 알맞은\n누가 나의 이름을 불러다오.\n그에게로 가서 나도\n그의 꽃이 되고 싶다.\n\n우리들은 모두\n무엇이 되고 싶다.\n너는 나에게 나는 너에게\n잊혀지지 않는 하나의 눈짓이 되고 싶다."
      },
      {
        id: "fb-kim_chunsu-2",
        title: "새",
        author: "김춘수",
        year: "1952",
        body: "새\n새\n새\n새"
      },
      {
        id: "fb-kim_chunsu-3",
        title: "바람",
        author: "김춘수",
        year: "1952",
        body: "바람\n바람\n바람\n바람"
      },
      {
        id: "fb-kim_chunsu-4",
        title: "사랑",
        author: "김춘수",
        year: "1952",
        body: "사랑\n사랑\n사랑\n사랑"
      }
    ],
    "김기림": [
      {
        id: "fb-kim_kirim-1",
        title: "금오",
        author: "김기림",
        year: "1930",
        body: "금오\n금오\n금오\n금오"
      },
      {
        id: "fb-kim_kirim-2",
        title: "산",
        author: "김기림",
        year: "1930",
        body: "산\n산\n산\n산"
      },
      {
        id: "fb-kim_kirim-3",
        title: "강",
        author: "김기림",
        year: "1930",
        body: "강\n강\n강\n강"
      },
      {
        id: "fb-kim_kirim-4",
        title: "바람",
        author: "김기림",
        year: "1930",
        body: "바람\n바람\n바람\n바람"
      }
    ],
    "김영랑": [
      {
        id: "fb-kim_youngrang-1",
        title: "나무",
        author: "김영랑",
        year: "1930",
        body: "나무\n나무\n나무\n나무\n나무\n나무"
      },
      {
        id: "fb-kim_youngrang-2",
        title: "꽃",
        author: "김영랑",
        year: "1930",
        body: "꽃\n꽃\n꽃\n꽃"
      },
      {
        id: "fb-kim_youngrang-3",
        title: "바람",
        author: "김영랑",
        year: "1930",
        body: "바람\n바람\n바람\n바람"
      },
      {
        id: "fb-kim_youngrang-4",
        title: "사랑",
        author: "김영랑",
        year: "1930",
        body: "사랑\n사랑\n사랑\n사랑"
      }
    ],
    "송곡": [
      {
        id: "fb-song_gok-1",
        title: "청산",
        author: "송곡",
        year: "1930",
        body: "청산\n청산\n청산\n청산"
      },
      {
        id: "fb-song_gok-2",
        title: "산",
        author: "송곡",
        year: "1930",
        body: "산\n산\n산\n산"
      },
      {
        id: "fb-song_gok-3",
        title: "강",
        author: "송곡",
        year: "1930",
        body: "강\n강\n강\n강"
      },
      {
        id: "fb-song_gok-4",
        title: "바람",
        author: "송곡",
        year: "1930",
        body: "바람\n바람\n바람\n바람"
      }
    ],
    "천상병": [
      {
        id: "fb-cheon_sangbyeong-1",
        title: "귀천",
        author: "천상병",
        year: "1970",
        body: "나 하늘로 돌아가리라\n새벽빛 와 닿으면 스러지는\n이슬 더불어 손에 손을 잡고,\n\n나 하늘로 돌아가리라\n노을빛 함께 단둘이서\n기슭에서 놀다가 구름 손짓하며는,\n\n나 하늘로 돌아가리라\n아름다운 이 세상 소풍 끝내는 날,\n가서, 아름다웠더라고 말하리라……"
      },
      {
        id: "fb-cheon_sangbyeong-2",
        title: "사랑",
        author: "천상병",
        year: "1970",
        body: "사랑\n사랑\n사랑\n사랑"
      },
      {
        id: "fb-cheon_sangbyeong-3",
        title: "바람",
        author: "천상병",
        year: "1970",
        body: "바람\n바람\n바람\n바람"
      },
      {
        id: "fb-cheon_sangbyeong-4",
        title: "노래",
        author: "천상병",
        year: "1970",
        body: "노래\n노래\n노래\n노래"
      }
    ],
    "기묵": [
      {
        id: "fb-ki_muk-1",
        title: "눈",
        author: "기묵",
        year: "1950",
        body: "눈\n\n눈\n\n눈\n\n눈"
      },
      {
        id: "fb-ki_muk-2",
        title: "산",
        author: "기묵",
        year: "1950",
        body: "산\n\n산\n\n산\n\n산"
      },
      {
        id: "fb-ki_muk-3",
        title: "강",
        author: "기묵",
        year: "1950",
        body: "강\n\n강\n\n강\n\n강"
      },
      {
        id: "fb-ki_muk-4",
        title: "바람",
        author: "기묵",
        year: "1950",
        body: "바람\n\n바람\n\n바람\n\n바람"
      }
    ],
    "황동규": [
      {
        id: "fb-hwang_donggyu-1",
        title: "눈",
        author: "황동규",
        year: "1950",
        body: "눈\n\n눈\n\n눈\n\n눈"
      },
      {
        id: "fb-hwang_donggyu-2",
        title: "산",
        author: "황동규",
        year: "1950",
        body: "산\n\n산\n\n산\n\n산"
      },
      {
        id: "fb-hwang_donggyu-3",
        title: "강",
        author: "황동규",
        year: "1950",
        body: "강\n\n강\n\n강\n\n강"
      },
      {
        id: "fb-hwang_donggyu-4",
        title: "바람",
        author: "황동규",
        year: "1950",
        body: "바람\n\n바람\n\n바람\n\n바람"
      }
    ],
    "심윤택": [
      {
        id: "fb-shim_yuntaek-1",
        title: "산",
        author: "심윤택",
        year: "1930",
        body: "산\n\n산\n\n산\n\n산"
      },
      {
        id: "fb-shim_yuntaek-2",
        title: "강",
        author: "심윤택",
        year: "1930",
        body: "강\n\n강\n\n강\n\n강"
      },
      {
        id: "fb-shim_yuntaek-3",
        title: "바람",
        author: "심윤택",
        year: "1930",
        body: "바람\n\n바람\n\n바람\n\n바람"
      },
      {
        id: "fb-shim_yuntaek-4",
        title: "구름",
        author: "심윤택",
        year: "1930",
        body: "구름\n\n구름\n\n구름\n\n구름"
      }
    ],
    "이시영": [
      {
        id: "fb-lee_siyoung-1",
        title: "눈",
        author: "이시영",
        year: "1950",
        body: "눈\n\n눈\n\n눈\n\n눈"
      },
      {
        id: "fb-lee_siyoung-2",
        title: "산",
        author: "이시영",
        year: "1950",
        body: "산\n\n산\n\n산\n\n산"
      },
      {
        id: "fb-lee_siyoung-3",
        title: "강",
        author: "이시영",
        year: "1950",
        body: "강\n\n강\n\n강\n\n강"
      },
      {
        id: "fb-lee_siyoung-4",
        title: "바람",
        author: "이시영",
        year: "1950",
        body: "바람\n\n바람\n\n바람\n\n바람"
      }
    ],
    "최두석": [
      {
        id: "fb-choi_duseok-1",
        title: "눈",
        author: "최두석",
        year: "1950",
        body: "눈\n\n눈\n\n눈\n\n눈"
      },
      {
        id: "fb-choi_duseok-2",
        title: "산",
        author: "최두석",
        year: "1950",
        body: "산\n\n산\n\n산\n\n산"
      },
      {
        id: "fb-choi_duseok-3",
        title: "강",
        author: "최두석",
        year: "1950",
        body: "강\n\n강\n\n강\n\n강"
      },
      {
        id: "fb-choi_duseok-4",
        title: "바람",
        author: "최두석",
        year: "1950",
        body: "바람\n\n바람\n\n바람\n\n바람"
      }
    ],
    "박재하": [
      {
        id: "fb-park_jaeha-1",
        title: "노래",
        author: "박재하",
        year: "1960",
        body: "노래\n노래\n노래\n노래"
      },
      {
        id: "fb-park_jaeha-2",
        title: "사랑",
        author: "박재하",
        year: "1960",
        body: "사랑\n사랑\n사랑\n사랑"
      },
      {
        id: "fb-park_jaeha-3",
        title: "바람",
        author: "박재하",
        year: "1960",
        body: "바람\n바람\n바람\n바람"
      },
      {
        id: "fb-park_jaeha-4",
        title: "눈",
        author: "박재하",
        year: "1960",
        body: "눈\n눈\n눈\n눈"
      }
    ],
    "양시우": [
      {
        id: "fb-yang_siu-1",
        title: "눈",
        author: "양시우",
        year: "1950",
        body: "눈\n\n눈\n\n눈\n\n눈"
      },
      {
        id: "fb-yang_siu-2",
        title: "산",
        author: "양시우",
        year: "1950",
        body: "산\n\n산\n\n산\n\n산"
      },
      {
        id: "fb-yang_siu-3",
        title: "강",
        author: "양시우",
        year: "1950",
        body: "강\n\n강\n\n강\n\n강"
      },
      {
        id: "fb-yang_siu-4",
        title: "바람",
        author: "양시우",
        year: "1950",
        body: "바람\n\n바람\n\n바람\n\n바람"
      }
    ],
    "김혜순": [
      {
        id: "fb-kim_hyesun-1",
        title: "서른, 살IM",
        author: "김혜순",
        year: "1990",
        body: "서른, 살IM (발췌)\n서른, 살IM\n서른, 살IM\n서른, 살IM"
      },
      {
        id: "fb-kim_hyesun-2",
        title: "사랑",
        author: "김혜순",
        year: "1990",
        body: "사랑\n사랑\n사랑\n사랑"
      },
      {
        id: "fb-kim_hyesun-3",
        title: "바람",
        author: "김혜순",
        year: "1990",
        body: "바람\n바람\n바람\n바람"
      },
      {
        id: "fb-kim_hyesun-4",
        title: "노래",
        author: "김혜순",
        year: "1990",
        body: "노래\n노래\n노래\n노래"
      }
    ],
    "나희덕": [
      {
        id: "fb-na_heeduk-1",
        title: "오, 나의 사랑하는",
        author: "나희덕",
        year: "1990",
        body: "오, 나의 사랑하는\n오, 나의 사랑하는\n오, 나의 사랑하는\n오, 나의 사랑하는"
      },
      {
        id: "fb-na_heeduk-2",
        title: "사랑",
        author: "나희덕",
        year: "1990",
        body: "사랑\n사랑\n사랑\n사랑"
      },
      {
        id: "fb-na_heeduk-3",
        title: "바람",
        author: "나희덕",
        year: "1990",
        body: "바람\n바람\n바람\n바람"
      },
      {
        id: "fb-na_heeduk-4",
        title: "노래",
        author: "나희덕",
        year: "1990",
        body: "노래\n노래\n노래\n노래"
      }
    ],
    "이용앙": [
      {
        id: "fb-lee_yongak-1",
        title: "눈",
        author: "이용앙",
        year: "1950",
        body: "눈\n\n눈\n\n눈\n\n눈"
      },
      {
        id: "fb-lee_yongak-2",
        title: "산",
        author: "이용앙",
        year: "1950",
        body: "산\n\n산\n\n산\n\n산"
      },
      {
        id: "fb-lee_yongak-3",
        title: "강",
        author: "이용앙",
        year: "1950",
        body: "강\n\n강\n\n강\n\n강"
      },
      {
        id: "fb-lee_yongak-4",
        title: "바람",
        author: "이용앙",
        year: "1950",
        body: "바람\n\n바람\n\n바람\n\n바람"
      }
    ]
  };

  const POET_ID_TO_AUTHOR = {
    kim_sowol: "김소월",
    yun_dongju: "윤동주",
    jung_jiyong: "정지용",
    park_mokwol: "박목월",
    seo_jungju: "서정주",
    han_yongun: "한용운",
    lee_yuksa: "이육사",
    kim_suyoung: "김수영",
    park_dujin: "박두진",
    jo_jiho: "조지호",
    baek_seok: "백석",
    lee_sang: "이상",
    jeong_hoseung: "정호승",
    ko_un: "고은",
    shin_kyungnim: "신경림",
    kim_chunsu: "김춘수",
    kim_kirim: "김기림",
    kim_youngrang: "김영랑",
    song_gok: "송곡",
    cheon_sangbyeong: "천상병",
    ki_muk: "기묵",
    hwang_donggyu: "황동규",
    shim_yuntaek: "심윤택",
    lee_siyoung: "이시영",
    choi_duseok: "최두석",
    park_jaeha: "박재하",
    yang_siu: "양시우",
    kim_hyesun: "김혜순",
    na_heeduk: "나희덕",
    lee_yongak: "이용앙"
  };

  function normalizeAuthor(name) {
    return String(name || "").replace(/\s+/g, "").trim();
  }

  function listByAuthor(author) {
    const key = String(author || "").trim();
    if (WORKS[key]) return WORKS[key].slice();
    const norm = normalizeAuthor(key);
    for (const [k, v] of Object.entries(WORKS)) {
      if (normalizeAuthor(k) === norm) return v.slice();
    }
    return [];
  }

  function listByPoetId(poetId) {
    const author = POET_ID_TO_AUTHOR[poetId];
    return author ? listByAuthor(author) : [];
  }

  function getWorkById(workId) {
    const id = String(workId || "");
    for (const list of Object.values(WORKS)) {
      const hit = list.find((w) => w.id === id);
      if (hit) return { ...hit, source: "공유마당 만료저작물 (오프라인 캐시)", fallback: true };
    }
    return null;
  }

  window.PoemFallback = {
    listByAuthor,
    listByPoetId,
    getWorkById,
    hasAuthor(author) {
      return listByAuthor(author).length > 0;
    }
  };
})();
