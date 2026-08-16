// 建筑分配

global.BuildingManager={


select:function(island){


var r=Math.random()



if(
r<0.1
&&
island.radius>100
)
{
return "castle"
}



if(
r<0.3
)
{
return "house"
}



return null


}


}