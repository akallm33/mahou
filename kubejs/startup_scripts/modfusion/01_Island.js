// 岛屿数据对象

global.Island = function(data){


this.x=data.x
this.y=data.y
this.z=data.z


this.radius=data.radius

this.height=data.height


this.building=null

this.biome=null


}



global.Island.prototype.distance=function(other){


var dx=this.x-other.x

var dz=this.z-other.z


return Math.sqrt(
dx*dx+dz*dz
)

}



global.Island.prototype.isOverlap=function(other){


return this.distance(other)
<
this.radius+
other.radius+
global.FusionConfig.collisionPadding


}