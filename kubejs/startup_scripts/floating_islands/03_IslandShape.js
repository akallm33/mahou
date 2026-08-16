// 控制岛屿轮廓

global.IslandShape={


getRadius:function(island,angle){


var n =
global.FusionNoise.value(
Math.cos(angle)*10,
Math.sin(angle)*10
)



return island.radius*
(
1+n*0.25
)


}



}