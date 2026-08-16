// 暂时模拟生态

global.BiomeManager={


random:function(){


var list=[

"forest",

"ruins",

"plain"

]


return list[
Math.floor(
Math.random()*list.length
)
]


}


}