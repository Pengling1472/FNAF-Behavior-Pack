import { world } from '@minecraft/server'

const overworld = world.getDimension( 'overworld' )

class Movement {
    constructor( name, direction, movement, state, speed = 15 ) {
        this.name = name
        this.direction = direction
        this.movement = movement
        this.state = state
        this.speed = speed
    }
}

export class Freddy {
    constructor( aiLevel ) {
        this.locations = new Map( [
            [ 'main-stage'      , [ new Movement( 'dining-area', 1, [ 9 ], 4 ), new Movement( 'restroom', 1, [ 4, 24, 10, 3, 1, -1 ], 5 ) ] ],
            [ 'restroom'        , [ new Movement( 'dining-area', 0, [ -2, -11, -24, 5 ], 4 ),  new Movement( 'kitchen', 0, [ -2, -11, -6, 18, -5, 7, 10, 6, -5 ], 4 ) ] ],
            [ 'kitchen'         , [ new Movement( 'east-hall', 0, [ -5, -13, -7, 3 ], 4 ) ] ],
            [ 'dining-area'     , [ new Movement( 'east-hall', 1, [ 13, 6, 3 ], 4 ), new Movement( 'kitchen', 1, [ 13, 13, 7, 10, 6, -5 ], 4 ) ] ],
            [ 'east-hall'       , [ new Movement( 'office', 1, [ 24, 1, 1, -1, -1 ], 6 ) ] ]
        ] )
        this.name = 'Freddy'
        this.aiLevel = aiLevel
        this.currentLocation = 'main-stage'
        this.currentPlayer = false
        this.ticks = 0
        this.door = 1
        this.cooldown = 0
        this.state = 'idle'
        this.attack = false
        this.autopilot = true
        this.attackDelay = 100
        this.entity = overworld.getEntities( { tags: [ 'Freddy' ] } )[ 0 ]
        this.location = { x: 0.5, y: 2, z: -44.5 }
        this.rotation = { x: 0, y: 0 }
    }
}
export class Bonnie {
    constructor( aiLevel ) {
        this.locations = new Map( [
            [ 'main-stage'      , [ new Movement( 'dining-area', 0, [ -5, 6, -4, 9, 3 ], 0 ), new Movement( 'back-stage', 0, [ -5, 6, -14, 6 ], 6 ) ] ],
            [ 'back-stage'      , [ new Movement( 'dining-area', 1, [ -6, 10, 9, 3 ], 0 ) ] ],
            [ 'dining-area'     , [ new Movement( 'west-hall', 0, [ -3, 8, 6, 7 ], 0 ), new Movement( 'back-stage', 0, [ -3, -9, -10, 6 ], 6 ) ] ],
            [ 'west-hall'       , [ new Movement( 'west-hall-corner', 1, [ 21, -1, 1, 1, -1 ], 0, 10 ), new Movement( 'supply-closet', 1, [ 9, -8, -1, -2, 1, 1 ], 0, 5 ) ] ],
            [ 'supply-closet'   , [ new Movement( 'west-hall', 0, [ 9, -9, -1, -1, 1, 1 ], 0, 5 ) ] ],
            [ 'west-hall-corner', [ new Movement( 'office', 1, [ -3, 1 ], 5, 5 ), new Movement( 'west-hall', 1, [ -21, -1, -1, 1, 1 ], 0 ) ] ],
            [ 'office'          , [ new Movement( 'dining-area', 0, [ -1, -25, -6, -8, 3 ], 0 ) ] ]
        ] )
        this.name = 'Bonnie'
        this.aiLevel = aiLevel
        this.currentLocation = 'main-stage'
        this.currentPlayer = false
        this.ticks = 0
        this.door = 0
        this.state = 'idle'
        this.attack = false
        this.kill = false
        this.autopilot = true
        this.entity = overworld.getEntities( { tags: [ 'Bonnie' ] } )[ 0 ]
        this.attackDelay = 100
        this.location = { x: -2.5, y: 2, z: -46.5 }
        this.rotation = { x: 0, y: 0 }
    }
}
export class Chica {
    constructor( aiLevel ) {
        this.locations = new Map( [
            [ 'main-stage'      , [ new Movement( 'dining-area', 0, [ 5, 6, -2, 9, -3 ], 4 ), new Movement( 'restroom', 0, [ 5, 6, 14, 15 ], 0 ) ] ],
            [ 'restroom'        , [ new Movement( 'dining-area', 1, [ -15, -16, 9, -3 ], 4 )] ],
            [ 'dining-area'     , [ new Movement( 'east-hall', 0, [ 3, 9, 2, 9 ], 0 ), new Movement( 'kitchen', 0, [ 3, 9, 7, 14 ], 5 ) ] ],
            [ 'kitchen'         , [ new Movement( 'dining-area', 1, [ -14, -7, -9, -3 ], 0 ) ] ],
            [ 'east-hall'       , [ new Movement( 'east-hall-corner', 1, [ 18, 1, 1, -1, -1 ], 0, 10 ) ] ],
            [ 'east-hall-corner', [ new Movement( 'office', 1, [ -7, -3 ], 6, 5 ), new Movement( 'east-hall', 1, [ -18, 1, -1, -1, 1 ], 0 ) ] ],
            [ 'office'          , [ new Movement( 'dining-area', 0, [ 3, -20, -2, -9, -3 ], 0 ) ] ]
        ] )
        this.name = 'Chica'
        this.aiLevel = aiLevel
        this.currentLocation = 'main-stage'
        this.currentPlayer = false
        this.ticks = 0
        this.state = 'idle'
        this.door = 1
        this.attack = false
        this.kill = false
        this.autopilot = true
        this.entity = overworld.getEntities( { tags: [ 'Chica' ] } )[ 0 ]
        this.attackDelay = 100
        this.location = { x: 3.5, y: 2, z: -46.5 }
        this.rotation = { x: 0, y: 0 }
    }
}
export class Foxy {
    constructor( aiLevel ) {
        this.locations = new Map( [
            [ 'pirate-cove' , [ new Movement( 'stage-2', 0, [ 3 ], 4, 0 ) ] ],
            [ 'stage-2'     , [ new Movement( 'stage-3', 0, [ 3 ], 5, 0 ) ] ],
            [ 'stage-3'     , [ new Movement( 'stage-4', 1, [ 2, 7 ], 1, 0 ) ] ],
            [ 'stage-4'     , [ new Movement( 'office', 0, [ 3, 24, 3 ], 1, 3 ) ] ]
        ] )
        this.name = 'Foxy'
        this.aiLevel = aiLevel
        this.currentLocation = 'pirate-cove'
        this.currentPlayer = false
        this.ticks = 0
        this.cooldown = 0
        this.attack = false
        this.autopilot = true
        this.attackDelay = 100
        this.state = 'idle'
        this.door = 0
        this.entity = overworld.getEntities( { tags: [ 'Foxy' ] } )[ 0 ]
        this.location = { x: -23.5, y: 2, z: -24.5 }
        this.rotation = { x: 0, y: -90 }
    }
}