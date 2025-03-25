import { world, system, MolangVariableMap, BlockPermutation } from '@minecraft/server'
import { ModalFormData, ActionFormData } from "@minecraft/server-ui"
import { Freddy, Bonnie, Chica, Foxy } from './animatronics'

const overworld = world.getDimension( 'overworld' )

const executeEntityDoor = ( blockLocation, player = false, openDoor = null, locked = null ) => {
    const [ door ] = overworld.getEntities( { type: 'fnaf:door_entity', maxDistance: 4.5, location: blockLocation.center() } )

    if ( player ) if ( door.getProperty( 'fnaf:locked' ) ) return player.sendMessage( 'Door is locked!' )
    if ( locked != null ) door.setProperty( 'fnaf:locked', locked )
    if ( openDoor != null ) if ( !!door.getProperty( 'fnaf:state' ) == openDoor ) return 

    const x = door.getRotation().y / 90
    const direction = [ 'north', 'east', 'south', 'west' ]
    const state = door.getProperty( 'fnaf:state' )
    const mirror = door.getProperty( 'fnaf:mirrored' ) ? 1 : 0
    const facing = x >= 0 ? x % 4 : x % 4 + 4
    let commands = [
        [ [ 0, -2 ], [ -2, 0 ] ],
        [ [ 2, 0 ], [ 0, -2 ] ],
        [ [ 0, 2 ], [ 2, 0 ] ],
        [ [ -2, 0 ], [ 0, 2 ] ]
    ]

    if ( mirror ) commands = commands.map( ( [ x, y ] ) => [ x, y.map( x => x * -1 ) ] )
    
    const [ air, block ] = state ? commands[ facing ] : commands[ facing ].reverse()
    const [ x1, y1 ] = air.map( x => x == 0 ? '' : x )
    const [ x2, y2 ] = block.map( x => x == 0 ? '' : x )

    door.setProperty( 'fnaf:state', ( state + 1 ) % 2 )
    door.runCommand( `fill ~ ~ ~ ~${x1} ~-3 ~${y1} air` )
    door.runCommand( `fill ~ ~ ~ ~${x2} ~-3 ~${y2} ${state ? 'fnaf:close_collision' : 'fnaf:open_collision'} ["minecraft:facing_direction"="${direction[ state ? facing : ( facing + ( mirror ? 3 : 1 ) ) % 4 ]}"]` )
    
    if ( player ) player.runCommand( `playsound ${state ? 'close' : 'open'}.bamboo_wood_door @s` )
}

const executeDoor = ( index, activate ) => {
    const location = [ '-4 0', '4 0' ][ index ]

    for ( let i = activate ? 1 : 5; i < 6 && i > 0; activate ? i++ : i-- ) system.runTimeout( () => {
        overworld.runCommandAsync( `structure load Door${i} ${location} 0` )
    }, activate ? i * 2 : 10 - i * 2 )
    overworld.runCommand( `playsound fnaf.door @a ${location} 1 100000` )
}

const cycleCamera = ( player, num ) => {
    setLevel( player, 14 )

    const index = cameraLocation.map( camera => camera.name ).indexOf( players.get( player.name ).currentCamera )
    const { name, x, y, z, rotx, roty, ui } = cameraLocation[ ( index + num < 0 ? 10 : index + num ) % cameraLocation.length ]

    player.runCommandAsync( `camera @s set minecraft:free pos ${x} ${y} ${z} rot ${rotx} ${roty}` )

    system.runTimeout( () => {
        player.playSound( num > 0 || num < 0 ? 'fnaf.blip' : 'fnaf.camera', { location: { x, y, z } } )
    }, 3 )
    system.runTimeout( () => {
        players.get( player.name ).currentCamera = name
        setLevel( player, ui )
    }, 5 )
}

const exitCamera = ( player ) => {
    if ( Math.random() <= 0.01 && game.state ) game.goldenFreddy.start()

    setLevel( player, 14 )

    players.get( player.name ).cameraUsage = false
    game.usage[ 4 ] = ![ ...players.values() ].every( player => player.cameraUsage == false )

    system.runTimeout( () => {
        player.runCommandAsync( 'replaceitem entity @s slot.hotbar 3 air' )
        player.runCommandAsync( 'replaceitem entity @s slot.hotbar 4 air' )
        player.runCommandAsync( 'replaceitem entity @s slot.hotbar 5 air' )
        player.runCommandAsync( 'camera @s clear' )

        setLevel( player, 0 )
    }, 2 )

    system.runTimeout( () => {
        player.runCommandAsync( 'stopsound @s fnaf.camera' )
        player.playSound( 'fnaf.put_down' )
    }, 5 )  
}

const saveArcade = ( player, teleport = true ) => {
    const playerData = players.get( player.name )
    const arcade = playerData.arcade.type
    
    playerData.arcade.location[ arcade ] = player.location
    player.runCommand( 'replaceitem entity @s slot.hotbar 3 air 1 0 { "item_lock": { "mode": "lock_in_slot" } }' )
    player.runCommand( 'replaceitem entity @s slot.hotbar 4 air 1 0 { "item_lock": { "mode": "lock_in_slot" } }' )
    player.runCommand( 'replaceitem entity @s slot.hotbar 5 air 1 0 { "item_lock": { "mode": "lock_in_slot" } }' )
    
    const resetPlayerArcade = () => {
        if ( teleport ) player.teleport( { x: arcade ? -16 : -13, y: 0, z: -22.5 }, { rotation: { x: 0, y: 0 } } )
            
        playerData.arcade.playing = false
        playerData.arcade.played[ arcade ] = true
        
        player.runCommand( 'fog @s remove fog' )
        player.runCommand( 'effect @s clear resistance' )
    }
    
    if ( !teleport ) return resetPlayerArcade()
        
    player.onScreenDisplay.setTitle( 'transition', { fadeInDuration: 10, stayDuration: 10, fadeOutDuration: 10 } )
    system.runTimeout( resetPlayerArcade, 10 )
} 

const transferItems = ( player, min, max ) => {
    const [ mob ] = overworld.getEntities( { type: 'fnaf:lost_and_found' } )

    if ( mob ) for ( let i = min; i <= max; i++ ) if ( player.getComponent( 'inventory' ).container.getItem( i )?.lockMode == 'none' ) player.getComponent( 'inventory' ).container.transferItem( i, mob.getComponent( 'inventory' ).container )
}

const setLevel = ( player, level ) => {
    player.resetLevel()
    player.addLevels( level )
}

const runCommands = ( ...commands ) => {
    for ( const command of commands ) overworld.runCommandAsync( command )
}

const vector3 = ( ...num ) => {
    const [ x, y, z ] = num

    return { x, y, z }
}

const toRadians = angle => {
    return angle * Math.PI / 180
}

world.beforeEvents.worldInitialize.subscribe( ( { blockComponentRegistry, itemComponentRegistry } ) => {
    blockComponentRegistry.registerCustomComponent(
        'fnaf:texture',
        { onPlayerInteract( event ) { 
            if ( event.player.runCommand( 'testfor @s[hasitem={location=slot.weapon.mainhand,item=stick}]' ).successCount ) event.block.setPermutation( event.block.permutation.withState( 'fnaf:texture', event.block.permutation.getState( 'fnaf:texture' ) + 1 ) )
        } }
    )
    blockComponentRegistry.registerCustomComponent(
        'fnaf:honk',
        { onPlayerInteract( event ) {
            event.player.runCommand( 'playsound fnaf.honk @s' )
        } }
    )
    blockComponentRegistry.registerCustomComponent(
        'fnaf:pizza',
        { onPlayerInteract( event ) {
            event.player.runCommand( 'give @s fnaf:pizza' )
        } }
    )
    blockComponentRegistry.registerCustomComponent(
        'fnaf:door',
        { onPlayerInteract( event ) { executeEntityDoor( event.block, event.player ) } }
    )
    blockComponentRegistry.registerCustomComponent(
        'fnaf:button',
        { onPlayerInteract( event ) {
            if ( Object.values( event.block.location ).join( ' ' ) == '-3 0 -3' ) {
                event.player.runCommand( `playsound fnaf.blip @s` )

                const reset = new ActionFormData

                reset.title( 'Are you sure you want to reset?' )
                reset.body( '\nIf button isn\'t working, leave and rejoin\n\n' )
                reset.button( 'reset' )

                reset.show( event.player ).then( response => {
                    if ( response.canceled ) return

                    game.reset()
                } )

                return
            }

            if ( game.state || game.button ) return overworld.runCommand( 'playsound fnaf.door_error @a 0 2 -21 10000000' )

            game.button = true

            event.player.runCommand( `playsound fnaf.blip @s` )
            
            const [ button ] = overworld.getEntities( { type: 'fnaf:button', maxDistance: 1, location: event.block.center() } )

            button.playAnimation( 'pressed' )

            const option = new ActionFormData()

            option.title( 'Game Options' )

            option.button( 'Nights' )
            option.button( 'Team' )
            option.button( 'Settings' )
            option.button( 'Start' )

            option.show( event.player ).then( response => {
                if ( response.canceled ) return game.button = false

                switch ( response.selection ) {
                    case 0:
                        const nights = new ActionFormData

                        nights.title( 'Select a Night' )
                        nights.body( '\nCustom AI levels will not work for these nights and throughtout the night the AI levels changes\n\n' )

                        nights.button( 'Night 1  55' )
                        nights.button( 'Night 2  75' )
                        nights.button( 'Night 3  105' )
                        nights.button( 'Night 4  135' )
                        nights.button( 'Night 5  245' )

                        nights.show( event.player ).then( response => {
                            game.button = false

                            if ( response.canceled ) return

                            const nightList = [ [
                                [ 0, [ 0, 3, 1, 1 ] ],
                                [ 3, [ 0, 3, 1, 1 ] ],
                                [ 4, [ 0, 5, 3, 3 ] ]
                            ],
                            [
                                [ 0, [ 1, 0, 5, 2 ] ],
                                [ 2, [ 1, 1, 5, 2 ] ],
                                [ 3, [ 1, 2, 6, 3 ] ],
                                [ 4, [ 1, 3, 7, 4 ] ]
                            ],
                            [
                                [ 0, [ Math.floor( Math.random() * 2 ) + 1, 2, 4, 6 ] ],
                                [ 2, [ Math.floor( Math.random() * 2 ) + 1, 3, 4, 6 ] ],
                                [ 3, [ Math.floor( Math.random() * 2 ) + 1, 4, 5, 7 ] ],
                                [ 4, [ Math.floor( Math.random() * 2 ) + 1, 5, 6, 8 ] ]
                            ],
                            [
                                [ 0, [ 3, 5, 7, 5 ] ],
                                [ 2, [ 3, 6, 7, 5 ] ],
                                [ 3, [ 3, 7, 8, 6 ] ],
                                [ 4, [ 3, 8, 9, 7 ] ]
                            ],
                            [
                                [ 0, [ 4, 10, 12, 16 ] ],
                                [ 2, [ 4, 11, 12, 16 ] ],
                                [ 3, [ 4, 12, 13, 17 ] ],
                                [ 4, [ 4, 13, 14, 18 ] ]
                            ] ]

                            for ( const player of overworld.getPlayers() ) {
                                player.onScreenDisplay.setTitle( [ 'Night 1', 'Night 2', 'Night 3', 'Night 4', 'Night 5' ][ response.selection ], { stayDuration: 40, fadeInDuration: 10, fadeOutDuration: 10 } )
                                players.get( player.name ).team = 0
                            }

                            game.night = new Map( nightList[ response.selection ] )
                            game.state = true

                            system.runTimeout( () => game.start( 0, 0, 0, 0 ), 30 )
                        } )
                        break
                    case 1:
                        const team = new ModalFormData()
                        const playersData = []

                        team.title( 'Players Team Security/Animatronic' )

                        for ( const [ name, value ] of players.entries() ) {
                            playersData.push( [ name, !!value.team ] )
                            team.toggle( name, !!value.team )
                        }

                        team.show( event.player ).then( response => {
                            game.button = false

                            if ( response.canceled ) return

                            for ( const [ index, data ] of playersData.entries() ) {
                                const responseValue = response.formValues[ index ]
                                const [ name, value ] = data

                                players.get( name ).team = ~~responseValue

                                if ( responseValue != value ) world.sendMessage( `§s${name}§r is now ${responseValue ? 'Animatronic' : 'Security'}` )
                            }
                        } )

                        break
                    case 2:
                        const setting = new ModalFormData()
            
                        setting.title( 'Settings' )

                        const [ bear, bunny, chicken, fox, cooldown, fog, weather, freedom, walking, camera ] = [ ...game.settings.values() ]
            
                        setting.slider( 'Freddy', 0, 20, 1, bear )
                        setting.slider( 'Bonnie', 0, 20, 1, bunny )
                        setting.slider( 'Chica', 0, 20, 1, chicken )
                        setting.slider( 'Foxy', 0, 20, 1, fox )
                        setting.slider( 'Walking Cooldown', 1, 5, 1, cooldown )
                        
                        setting.toggle( 'No Fog', !!fog )
                        setting.toggle( 'Weather', !!weather )
                        setting.toggle( 'Free Roam ( Could break )', !!freedom )
                        setting.toggle( 'No Walking ( Harder difficulty )', !!walking )
                        setting.toggle( 'Camera Share', !!camera )
            
                        setting.submitButton( 'Save' )
            
                        setting.show( event.player ).then( response => {
                            game.button = false

                            if ( response.canceled ) return

                            for ( const [ index, key ] of [ ...game.settings.keys() ].entries() ) game.settings.set( key, response.formValues[ index ] )
                                
                            event.player.sendMessage( 'Settings Saved' )
                        } )
                        
                        break
                    case 3:
                        game.button = false

                        if ( game.arcade.boss ) return

                        const aiLevels = [ ...game.settings.values() ].slice( 0, 4 )
                        const [ freddy, bonnie, chica, foxy ] = aiLevels

                        if ( freddy == 1 && bonnie == 9 && chica == 8 && foxy == 7 ) {
                            for ( const player of world.getAllPlayers() ) {
                                player.runCommand( 'playsound fnaf.scream @s ~~~ 1 0.3' )
                                player.onScreenDisplay.setTitle( 'golden_freddy' )
                            }
                            game.settings.set( 'freddy', 5 )
                            game.settings.set( 'bonnie', 5 )
                            game.settings.set( 'chica', 5 )
                            game.settings.set( 'foxy', 5 )
                            return 
                        }

                        game.state = true
                        game.night = false

                        for ( const player of world.getAllPlayers() ) player.onScreenDisplay.setTitle( aiLevels.join( '/' ), { stayDuration: 40, fadeInDuration: 10, fadeOutDuration: 10 } )

                        system.runTimeout( () => game.start( freddy, bonnie, chica, foxy ), 30 )

                        break
                }
            } )

        } }
    )
    blockComponentRegistry.registerCustomComponent(
        'fnaf:camera',
        { onPlayerInteract( event ) {
            const player = event.player
                
            if ( [ 3, 4, 5 ].includes( player.selectedSlotIndex ) && players.get( player.name ).cameraUsage && player.getItemCooldown( 'camera' ) == 0 ) {
                player.startItemCooldown( 'camera', 5 )

                switch ( player.selectedSlotIndex ) {
                    case 3: cycleCamera( player, 1 ); break
                    case 5: cycleCamera( player, -1 ); break
                    case 4: exitCamera( player ); break
                }
                return
            }
            if ( players.get( player.name ).cameraUsage || game.powerdown ) return overworld.runCommand( 'playsound fnaf.door_error @a 0 1 -4 100000000' )
            if ( !game.settings.get( 'camera_share' ) || game.powerdown ) if ( [ ...players.values() ].map( player => player.cameraUsage ).includes( true ) ) return player.runCommand( 'playsound fnaf.door_error @s ~ ~ ~' )

            transferItems( player, 3, 5 )
            cycleCamera( player, 0 )

            player.runCommandAsync( 'replaceitem entity @s slot.hotbar 3 fnaf:back 1 0 { "item_lock": { "mode": "lock_in_slot" } }' )
            player.runCommandAsync( 'replaceitem entity @s slot.hotbar 4 fnaf:return 1 0 { "item_lock": { "mode": "lock_in_slot" } }' )
            player.runCommandAsync( 'replaceitem entity @s slot.hotbar 5 fnaf:next 1 0 { "item_lock": { "mode": "lock_in_slot" } }' )

            players.get( player.name ).cameraUsage = true
            game.usage[ 4 ] = true

            event.player.startItemCooldown( 'camera', 5 )
        } }
    )
    blockComponentRegistry.registerCustomComponent(
        'fnaf:arcade',
        { onPlayerInteract( event ) {
            const [ arcade ] = overworld.getEntities( { type: 'fnaf:arcade_machine', location: event.block.bottomCenter(), maxDistance: 1.6 } )

            if ( arcade ) game.arcade.play( event.player, arcade.getProperty( 'fnaf:type' ) )
        } }
    )
    itemComponentRegistry.registerCustomComponent(
        'fnaf:onUse',
        { onUse( event ) {    
            const player = event.source

            if ( player.getItemCooldown( 'camera' ) > 5 ) player.startItemCooldown( 'camera', 0 )
            if ( player.getItemCooldown( 'camera' ) > 0 ) return  
            
            player.startItemCooldown( 'camera', 5 )

            switch ( event.itemStack.typeId ) {
                case 'fnaf:next': cycleCamera( player, 1 ); break
                case 'fnaf:back': cycleCamera( player, -1 ); break
                case 'fnaf:return': exitCamera( player ); break
            }
        } }
    )
    itemComponentRegistry.registerCustomComponent(
        'fnaf:switch',
        { onUse( event ) {
            const playerData = players.get( event.source.name )
            const animatronic = game.animatronics[ playerData.animatronic ]

            switch ( event.itemStack.typeId ) {
                case 'fnaf:animatronic_switch': playerData.animatronic = ( playerData.animatronic + 1 ) % 4; break
                case 'fnaf:perspective': playerData.perspective = ( playerData.perspective + 1 ) % 2; break
                case 'fnaf:interact':
                    const block = animatronic.entity.getBlockFromViewDirection( { maxDistance: 5 } )?.block

                    if ( !block ) return
                    if ( block.typeId != 'fnaf:open_collision' && block.typeId != 'fnaf:close_collision' ) return

                    executeEntityDoor( block )
                    break
                case 'fnaf:pose':
                    if ( animatronic.state == 'moving' ) return event.source.sendMessage( 'Go into idle state to use the function' )

                    const stateNumber = [
                        [ 4, 5, 6, 7 ],
                        [ 5, 6 ],
                        [ 4, 5, 6 ],
                        [ 4, 5 ]
                    ][ playerData.animatronic ]
    
                    if ( animatronic.entity.getProperty( 'fnaf:state' ) < stateNumber[ 0 ] ) return animatronic.entity.setProperty( 'fnaf:state', stateNumber[ 0 ] ) 
    
                    animatronic.entity.setProperty( 'fnaf:state', stateNumber[ ( stateNumber.indexOf( animatronic.entity.getProperty( 'fnaf:state' ) ) + 1 ) % stateNumber.length ] ) 
                    break
            }
        } }
    )
    itemComponentRegistry.registerCustomComponent(
        'fnaf:move',
        { onUse( event ) {
            const playerData = players.get( event.source.name )
            const animatronic = game.animatronics[ playerData.animatronic ]

            if ( !game.state ) return
            if ( game.settings.get( 'free_roam' ) && event.itemStack.typeId == 'fnaf:move' ) {
                if ( playerData.perspective == 1 ) event.source.teleport( event.source.location, { rotation: animatronic.entity.getRotation() } )

                animatronic.state = animatronic.state == 'idle' ? 'moving' : 'idle'
                animatronic.entity.setProperty( 'fnaf:state', animatronic.state == 'idle' ? 0 : 1 )

                return
            }

            if ( event.itemStack.typeId == 'fnaf:kill' ) {
                if ( animatronic.attackDelay == 0 ) {
                    switch ( true ) {
                        case animatronic instanceof Freddy:
                            animatronic.attackDelay = 100
                            animatronic.currentPlayer = event.source.name
                            game.checkDoor( animatronic, event.source )
                            return
                        case animatronic instanceof Foxy:
                            animatronic.currentPlayer = event.source.name
                            game.moveChances( animatronic, true )
                            return
                    }
                }
                return
            }

            if ( animatronic.ticks == 100 ) {
                if ( !game.randomChance( animatronic.aiLevel, 20 ) ) {
                    event.source.sendMessage( 'Chances of moving the animatronic failed' )
                    return animatronic.ticks = 100 - game.settings.get( 'cooldown' ) * 20
                }
                animatronic.currentPlayer = event.source.name
                animatronic.ticks = 100 - game.settings.get( 'cooldown' ) * 20
                game.move( animatronic, animatronic.locations.get( animatronic.currentLocation )[ [ 3, 5 ].indexOf( event.source.selectedSlotIndex ) ] )
            }
        } }
    )
    itemComponentRegistry.registerCustomComponent( 'fnaf:candy', { onConsume( event ) {
        if ( !players.has( event.source.name ) ) return

        const arcade = players.get( event.source.name ).arcade

        if ( arcade.playing ) if ( arcade.health[ arcade.type ] < 9 ) {
            arcade.health[ arcade.type ]++
            event.source.runCommand( 'playsound fnaf.heal @s' )
        }
    } } )
    itemComponentRegistry.registerCustomComponent( 'fnaf:arcade', { onUse( event ) {
        switch ( event.itemStack.typeId ) {
            case 'fnaf:save': saveArcade( event.source ); break
            case 'fnaf:teleport':
                const playerList = new ActionFormData()
                const data = new Map()

                playerList.title( 'Select a player to teleport' )

                for ( const player of overworld.getPlayers() ) {
                    if ( !players.has( player.name ) || !players.has( event.source.name ) || event.source.name == player.name ) continue
                    if ( players.get( player.name ).arcade.type != players.get( event.source.name ).arcade.type || !players.get( player.name ).arcade.playing ) continue

                    playerList.button( player.name )
                    data.set( data.size, player.name )
                }

                if ( !data.size ) return event.source.sendMessage( 'There\'s no player to teleport.' )

                playerList.show( event.source ).then( response => {
                    if ( response.canceled ) return

                    event.source.runCommand( `tp @s ${data.get( response.selection )}` )
                } )
                break
            case 'fnaf:restart':
                const playerArcade = players.get( event.source.name ).arcade
                
                playerArcade.played[ playerArcade.type ] = false

                game.arcade.play( event.source, playerArcade.type )
                break
        }
    } } )
} )

class PlayerData {
    constructor() {
        this.currentCamera = 'main-stage'
        this.cameraUsage = false
        this.spectate = false
        this.animatronic = 0
        this.perspective = 0
        this.team = 0
        this.arcade = new ArcadeData()
    }
}

class PowerDown {
    constructor( time, animatronic ) {
        this.ticks = 0
        this.state = 0
        this.stopMusic = time
        this.animatronic = animatronic
    }
    start() {
        system.run( () => {
            this.ticks++

            if ( !game.state ) return this.ticks = 0

            switch ( this.state ) {
                case 0:
                    if ( this.ticks % 100 == 0 ) {
                        if ( this.chance() ) {
                            this.animatronic.entity.runCommand( 'teleport @s -5 0 1 270 0' )
                            this.animatronic.entity.setProperty( 'fnaf:state', 7 )
                            system.runTimeout( () => {
                                this.animatronic.entity.runCommand( 'effect @s clear' )
                                overworld.runCommand( 'playsound fnaf.music_box @a -4 0 1 100000' )
                            }, 10 )
                            this.state++
                            this.ticks = 0
                            break
                        }
                        overworld.runCommand( 'playsound fnaf.deepstep @a -7 0 -2 100000' )
                        this.animatronic.entity.runCommand( 'teleport @s -5 0 1 270 0' )
                    }
                    break
                case 1:
                    this.animatronic.entity.setProperty( 'fnaf:lit_eye', this.chance() )
                    if ( this.ticks >= this.stopMusic ) {
                        overworld.runCommand( 'stopsound @a fnaf.music_box' )
                        this.animatronic.entity.setProperty( 'fnaf:lit_eye', false )
                        this.animatronic.entity.runCommand( 'effect @s invisibility infinite 1 true' )
                        this.state++
                        this.ticks = 0
                    }
                    break
                case 2:
                    if ( this.ticks % 100 == 0 ) if ( this.chance() ) {
                        this.animatronic.entity.runCommand( 'effect @s clear' )
                        game.jumpscare( this.animatronic )
                        return
                    }
                    if ( this.ticks % 20 == 0 ) overworld.runCommand( 'music stop 0' )
                    break
            }

            this.start()
        } )
    }
    chance() {
        return Math.floor( Math.random() * 2 ) == 1 ? true : false
    }
}

class Confetti {
    constructor() {
        this.ticks = 0
        this.timeout = 300
    }
    start( location ) {
        system.run( () => {
            if ( this.ticks >= this.timeout ) return this.ticks = 0
            
            overworld.spawnParticle( 'fnaf.confetti', location )

            this.ticks++
            this.start( location )
        } )
    }
}

class GoldenFreddy {
    constructor() {
        this.ticks = 0
        this.timeout = 100
    }
    start() {
        if ( this.ticks > 0 ) return
        
        this.goldenFreddy = overworld.getEntities( { type: 'fnaf:golden_freddy', excludeTags: [ 'Henlo' ] } )[ 0 ]
        this.goldenFreddy.addEffect( 'minecraft:invisibility', 15, { showParticles: false } )
        this.goldenFreddy.teleport( { x: 0.5, y: 0, z: -1.5 } )

        overworld.runCommand( 'playsound fnaf.laugh_giggle_girl @a 0 0 0 100000000' )

        this.loop()
    }
    loop() {
        system.run( () => {
            if ( this.ticks % 15 == 0 ) for ( const player of overworld.getPlayers() ) {
                player.onScreenDisplay.setTitle( 'its_me' )
                player.runCommand( 'playsound fnaf.robot_voice @s' )
            }

            if ( this.ticks >= this.timeout ) {
                for ( const player of world.getAllPlayers() ) {
                    player.runCommand( 'playsound fnaf.scream @s ~~~ 1 0.3' )
                    player.onScreenDisplay.setTitle( 'golden_freddy' )
                }

                this.goldenFreddy.addEffect( 'minecraft:invisibility', 20, { showParticles: false } )
                this.goldenFreddy.teleport( { x: -21.1, y: 0, z: -31.1 } )
                this.ticks = 0

                return game.reset()
            }
            
            if ( overworld.getPlayers().map( player => players.get( player.name ).cameraUsage ).includes( true ) ) {
                this.goldenFreddy.addEffect( 'minecraft:invisibility', 20, { showParticles: false } )
                this.goldenFreddy.teleport( { x: -21.1, y: 0, z: -31.1 } )
                return this.ticks = 0
            }

            this.ticks++
            this.loop()
        } )
    }
}

class CupcakeBoss {
    constructor() {
        this.ticks = 0
        this.finalMusic = false
    }
    start() {
        for ( const player of overworld.getPlayers() ) {
            if ( !players.has( player.name ) ) continue
            if ( players.get( player.name ).arcade.playing ) saveArcade( player, false ) 
            
            const playerData = players.get( player.name )
            
            if ( playerData.cameraUsage ) exitCamera( player )
                
            players.get( player.name ).arcade.playing = true
            players.get( player.name ).arcade.type = 0

            player.runCommand( 'fog @s remove fog' )
            player.runCommand( 'give @s diamond_sword' )
            player.runCommand( 'replaceitem entity @s slot.weapon.offhand 0 shield 1 0' )
            player.teleport( { x: 800.5, y: 0, z: 815.5 }, { rotation: { x: 0, y: 180 } } )
        }

        system.runTimeout( () => {
            const entity = overworld.spawnEntity( 'fnaf:cupcake', { x: 800.5, y: 0, z: 800.5 } )

            overworld.runCommand( 'effect @e[type=fnaf:dj_music_man] clear' )
    
            system.runTimeout( () => {
                entity.triggerEvent( 'fnaf:boss_1' )
                entity.setProperty( 'fnaf:state', 1 )
    
                world.playMusic( 'fnaf.music_man_theme_1', { loop: true, fade: 1 } )
            }, 100 )
    
            game.arcade.boss = true

            this.cupcake = entity
            this.finalMusic = false
            this.ticks = 0
            this.tick()
        }, 20 )
    }
    tick() {
        system.run( () => {
            this.ticks++

            if ( this.cupcake.getComponent( 'health' ).currentValue < 1 ) {
                this.cupcake.getComponent( 'health' ).resetToDefaultValue()
                this.cupcake.setProperty( 'fnaf:state', 5 )
                this.cupcake.triggerEvent( 'fnaf:boss_5' )
                
                for ( let i = 0; i < 4; i++ ) system.runTimeout( () => {
                    overworld.runCommand( `playsound fnaf.scream @a ${Object.values( this.cupcake.location ).join( ' ' )} 0.3 ${[ 0.3, 0.4, 0.5, 0.6 ][ Math.floor( Math.random() * 4 ) ]}` )
                }, 20 * i )
                
                system.runTimeout( () => {
                    this.cupcake.kill()
                    game.arcade.boss = false

                    system.runTimeout( () => {
                        overworld.runCommand( 'effect @e[type=fnaf:dj_music_man] invisibility infinite 1 true' )
                        overworld.runCommand( 'kill @e[type=fnaf:mini_cupcake]' )
                        world.playMusic( 'fnaf.lobby', { loop: true, fade: 1 } )
                        game.confetti.start( vector3( -13, 0, -22.5 ) )

                        for ( const player of overworld.getPlayers() ) {
                            if ( !players.has( player.name ) ) continue

                            const playerData = players.get( player.name )
                            
                            if ( !playerData.arcade.playing ) continue
        
                            playerData.arcade.playing = false
                            world.scoreboard.getObjective( 'coins' ).addScore( player, 200 )

                            player.runCommand( 'clear @s shield' )
                            player.runCommand( 'clear @s diamond_sword' )
                            player.runCommand( 'playsound fnaf.rare_achievement @s' )
                            player.sendMessage( 'Congratulations! You just earned 200  fazbear coins for defeating Carl!' )
                            player.teleport( vector3( -13, 0, -22.5 ), { rotation: { x: 0, y: 0 } } )
                        }
                    }, 120 )
                }, 80 )

                return
            }

            const health = this.cupcake.getComponent( 'health' ).currentValue

            if ( health <= 600 && this.cupcake.getProperty( 'fnaf:state' ) == 1 ) {
                this.cupcake.triggerEvent( 'fnaf:boss_2' )
                this.cupcake.setProperty( 'fnaf:state', 2 )
                world.playMusic( 'fnaf.music_man_theme_2', { loop: true, fade: 1 } )
            }
            if ( health <= 400 && this.cupcake.getProperty( 'fnaf:state' ) == 2 ) {
                this.cupcake.triggerEvent( 'fnaf:boss_3' )
                this.cupcake.setProperty( 'fnaf:state', 3 )
                world.playMusic( 'fnaf.music_man_theme_3', { loop: true, fade: 1 } )
            }
            if ( health <= 200 && this.cupcake.getProperty( 'fnaf:state' ) == 3 ) {
                this.cupcake.triggerEvent( 'fnaf:boss_4' )
                this.cupcake.setProperty( 'fnaf:state', 4 )
                world.playMusic( 'fnaf.music_man_theme_4', { loop: true, fade: 1 } )
            }
            if ( health <= 100 ) {
                if ( this.ticks % 60 == 0 ) for ( let i = 0; i < 8; i++ ) {
                    const bomb = overworld.spawnEntity( 'fnaf:mini_cupcake', {...this.cupcake.location, y: this.cupcake.location.y + 5} )

                    bomb.setRotation( { x: 0, y: i * 45 } )

                    const viewDirection = bomb.getViewDirection()
                    
                    bomb.applyKnockback( viewDirection.x, viewDirection.z, 3, 1 )
                }
                if ( this.ticks % 60 == 0 ) this.cupcake.getComponent( 'health' ).setCurrentValue( this.cupcake.getComponent( 'health' ).currentValue + 2 ) 
                if ( !this.finalMusic ) {
                    this.finalMusic = true
                    world.playMusic( 'fnaf.music_man_theme_5', { loop: true, fade: 1 } )
                }
            }

            this.tick()
        } )
    }
}

class KingBooBoss {
    constructor() {
        this.ticks = 0
        this.impulse = false
        this.isAttacking = false 
    }
    start() {
        for ( const player of overworld.getPlayers() ) {
            if ( !players.has( player.name ) ) continue
            if ( players.get( player.name ).arcade.playing ) saveArcade( player, false ) 
            
            const playerData = players.get( player.name )
            
            if ( playerData.cameraUsage ) exitCamera( player )
                
            players.get( player.name ).arcade.playing = true
            players.get( player.name ).arcade.type = 1

            player.runCommand( 'fog @s remove fog' )
            player.runCommand( 'give @s diamond_sword' )
            player.runCommand( 'replaceitem entity @s slot.weapon.offhand 0 shield 1 0' )
            player.teleport( { x: -615.5, y: 32, z: -864.5 }, { rotation: { x: 0, y: 67 } } )
        }

        system.runTimeout( () => {
            const entity = overworld.spawnEntity( 'fnaf:king_boo', { x: -634.5, y: 33, z: -856.5 } )
    
            world.playMusic( 'fnaf.king_boo', { loop: true, fade: 1 } )
            game.arcade.boss = true

            entity.triggerEvent( 'fnaf:movement' )

            this.kingBoo = entity
            this.ticks = 0
            this.tick()
        }, 100 )
    }
    tick() {
        system.run( () => {
            if ( this.kingBoo.getComponent( 'health' ).currentValue < 1 ) return system.runTimeout( () => {
                game.arcade.boss = false
                game.confetti.start( vector3( -16, 0, -22.5 ) )
                
                world.playMusic( 'fnaf.lobby', { loop: true, fade: 1 } )
                overworld.runCommand( 'kill @e[type=zombie]' )

                for ( const player of overworld.getPlayers() ) {
                    if ( !players.has( player.name ) ) continue

                    const playerData = players.get( player.name )
                    
                    if ( !playerData.arcade.playing ) continue

                    playerData.arcade.playing = false
                    world.scoreboard.getObjective( 'coins' ).addScore( player, 200 )

                    player.runCommand( 'clear @s shield' )
                    player.runCommand( 'clear @s diamond_sword' )
                    player.runCommand( 'playsound fnaf.rare_achievement @s' )
                    player.sendMessage( 'Congratulations! You just earned 200  fazbear coins for defeating King Boo!' )
                    player.teleport( vector3( -16, 0, -22.5 ), { rotation: { x: 0, y: 0 } } )
                }

                this.ticks = 0
                this.impulse = false
                this.isAttacking = false 
            }, 100 )

            if ( this.impulse ) {
                const { x, y } = this.kingBoo.getRotation()
                const radius = 2

                const block = overworld.getBlock( {
                    x: this.kingBoo.location.x + ( radius * Math.sin( toRadians( 360 - y ) ) ) * ( Math.cos( toRadians( x ) ) ),
                    y: 31,
                    z: this.kingBoo.location.z + ( radius * Math.cos( toRadians( 360 - y ) ) ) * ( Math.cos( toRadians( x ) ) )
                } )

                if ( this.ticks % 20 == 0 ) this.kingBoo.teleport( { ...this.kingBoo.location, y: 32 }, { keepVelocity: true } )
                if ( block.typeId != 'minecraft:air' ) {
                    this.kingBoo.setRotation( { x, y: y + 45 } )
                    this.kingBoo.clearVelocity()

                    for ( const player of overworld.getPlayers() ) player.runCommand( 'camerashake add @s 0.8 0.3 positional' )
                }
                if ( block.typeId == 'minecraft:air' ) this.kingBoo.applyImpulse( vector3(
                    this.kingBoo.getViewDirection().x * 0.05,
                    this.kingBoo.getViewDirection().y * 0.05,
                    this.kingBoo.getViewDirection().z * 0.05,
                ) )
            }

            this.ticks++
            this.tick()
        } )
    }
    attack() {
        if ( this.isAttacking || this.impulse ) return

        if ( Math.random() <= 0.3 ) {
            this.isAttacking = true

            const random = Math.random()
            let cumulativeChance = 0.0
            let attackMove = 0

            for ( const [ index, chance ] of [ 0.4, 0.4, 0.2 ].entries() ) {
                cumulativeChance += chance

                if ( random < cumulativeChance ) { attackMove = index; break }
            }

            switch ( attackMove ) {
                case 0:
                    this.kingBoo.triggerEvent( 'fnaf:no_movement' )
                    this.kingBoo.playAnimation( 'angry' )
            
                    system.runTimeout( () => {
                        for ( let i = 0; i < 3; i++ ) {
                            const { x, z } = this.kingBoo.location
                    
                            const x2 = -5 + Math.floor( Math.random() * 7 )
                            const z2 = -5 + Math.floor( Math.random() * 7 )
                            
                            const newLocation = vector3( x + x2 + 3 * ( x2 > 0 ? 1 : -1 ), 31, z + z2 + 3 * ( z2 > 0 ? 1 : -1 ) )
                    
                            if ( !overworld.getBlock( newLocation ).isAir || !overworld.getBlock( { ...newLocation, y: 30 } ).isSolid ) continue
                            
                            system.runTimeout( () => overworld.spawnEntity( 'minecraft:zombie', newLocation ), i * 10 )
                        }
        
                        this.isAttacking = false
                    }, 50 )
                    break
                case 1:
                    this.kingBoo.triggerEvent( 'fnaf:no_movement' )
                    this.kingBoo.playAnimation( 'angry' )
            
                    system.runTimeout( () => {
                        for ( const player of overworld.getPlayers().filter( player => players.has( player.name ) ? players.get( player.name ).arcade.playing : false ) ) {
                            let location = player.location

                            for ( let i = 1; i <= 3; i++ ) {
                                system.runTimeout( () => overworld.spawnEntity( 'minecraft:lightning_bolt', location ), i * 20 )

                                location = overworld.getPlayers( { name: player.name } )[ 0 ].location
                            }
                        }
                        
                        this.isAttacking = false
                    }, 30 )
                    break
                case 2: this.roll(); break
            }
        }
    }
    roll() {
        const { x, z } = this.kingBoo.location

        if ( overworld.getBlock( { x, y: 31, z } ).isAir && overworld.getBlock( { x, y: 30, z } ).isSolid ) {
            this.kingBoo.playAnimation( 'roll' )
            this.kingBoo.triggerEvent( 'fnaf:no_movement_2' )
            this.kingBoo.teleport( { x, y: 32, z }, { rotation: { x: 0, y: this.kingBoo.getRotation().y } } )

            this.impulse = true

            system.runTimeout( () => {
                this.impulse = false
                this.isAttacking = false
            }, 200 )
        } else { this.isAttacking = false }
    }
}

class RaceData {
    constructor( color , id ) {
        this.color = color
        this.rank = -1
        this.id = id
    }
}

class Race {
    constructor() {
        this.players = new Map()
        this.spectate = false
        this.timeout = 3600
        this.ticks = 0
    }
    addPlayer( player, color ) {
        if ( this.players.size >= 6 ) return false

        this.players.set( player.name, new RaceData( color, this.players.size ) )
    }
    removePlayer( player ) {
        if ( this.players.has( player.name ) ) players.delete( player.name )
    }
    start() {
        const locations = [
            '807.5 0 -752.5',
            '803.5 0 -753.5',
            '807.5 0 -757.5',
            '803.5 0 -758.5',
            '807.5 0 -762.5',
            '803.5 0 -763.5'
        ]

        this.scoreboard = world.scoreboard.getObjective( 'race' )

        if ( this.scoreboard ) world.scoreboard.removeObjective( 'race' )

        this.scoreboard = world.scoreboard.addObjective( 'race', 'Leaderboard' )

        overworld.runCommand( 'scoreboard objectives setdisplay sidebar race' ) 

        for ( const player of overworld.getPlayers().filter( player => this.players.has( player.name ) ) ) {
            const playerData = this.players.get( player.name )
            const location = vector3( ...locations[ playerData.id ].split( ' ' ).map( Number ) )
            const car = overworld.spawnEntity( 'fnaf:car', location )

            player.teleport( location )
            this.scoreboard.setScore( player, 0 )

            car.getComponent( 'movement' ).setCurrentValue( 0.25 )
            car.getComponent( 'color' ).value = playerData.color
            car.addTag( `${playerData.id}` )

            player.runCommand( `ride @s start_riding @e[type=fnaf:car,r=3,tag="${playerData.id}"] teleport_rider` )
        }
    }
}

class ArcadeData {
    constructor() {
        this.type = 0
        this.health = [ 9, 9 ]
        this.playing = false
        this.played = [ false, false ]
        this.location = [ { x: 800.5, y: 66, z: 800.5 }, { x: -800.5, y: 0, z: -800.5 } ]
    }
}

class arcadeStartup {
    constructor() {
        this.boss = false
        this.cooldown = 20
    }
    play( player, arcade ) {
        if ( this.cooldown < 20 ) return
        
        this.cooldownCountdown()
        player.onScreenDisplay.setTitle( 'transition', { fadeInDuration: 10, stayDuration: 10, fadeOutDuration: 10 } )
        
        system.runTimeout( () => {
            const playerData = players.get( player.name )
            const PlayersArcadeData =  [ ...players.values() ].map( player => player.arcade )

            playerData.arcade.type = arcade
            playerData.arcade.playing = true

            if ( !arcade ) player.runCommand( 'fog @s push fnaf:maze fog' )
            if ( !playerData.arcade.played[ arcade ] ) {
                playerData.arcade.location[ arcade ] = [ { x: 800.5, y: 66, z: 800.5 }, { x: -800.5, y: 0, z: -800.5 } ][ arcade ]
                playerData.arcade.health[ arcade ] = 9
            }


            if ( PlayersArcadeData.every( arcade => arcade.playing && arcade.type == 0 ) ) world.playMusic( 'fnaf.maze', { fade: 1, loop: true } )
            if ( PlayersArcadeData.every( arcade => arcade.playing && arcade.type == 1 ) ) world.playMusic( 'fnaf.parkour', { fade: 1, loop: true } )

            player.teleport( playerData.arcade.location[ arcade ], { rotation: { x: 0, y: 270 } } )

            transferItems( player, 3, 5 )

            player.runCommand( 'effect @s resistance infinite 3 true' )
            system.runTimeout( () => player.runCommand( 'replaceitem entity @s slot.hotbar 3 fnaf:save 1 0 { "item_lock": { "mode": "lock_in_slot" } }' ), 10 )
            system.runTimeout( () => player.runCommand( 'replaceitem entity @s slot.hotbar 4 fnaf:teleport 1 0 { "item_lock": { "mode": "lock_in_slot" } }' ), 10 )
            system.runTimeout( () => player.runCommand( 'replaceitem entity @s slot.hotbar 5 fnaf:restart 1 0 { "item_lock": { "mode": "lock_in_slot" } }' ), 10 )
        }, 10 ) 
    }
    cooldownCountdown() {
        system.run( () => {
            if ( this.cooldown <= 0 ) return this.cooldown = 20
            this.cooldown--
            this.cooldownCountdown()
        } )
    }
}

class WorldTick {
    constructor() {
        this.ticks = 0
        this.active = false
    }
    start() {
        if ( this.active ) return

        this.active = true
        this.tick()
    }
    tick() { system.run( () => {
        if ( game.state ) return this.active = false

        for ( const player of overworld.getPlayers() ) {
            if ( !players.has( player.name ) ) continue

            const scoreboard = world.scoreboard.getObjective( 'coins' )
            const arcade = players.get( player.name ).arcade
            
            if ( !arcade.playing ) {
                if ( scoreboard.hasParticipant( player ) ) player.onScreenDisplay.setActionBar( `c  ${scoreboard.getScore( player )} fazbear coins` )
                continue
            }
            
            player.onScreenDisplay.setActionBar( `h ${Array( 10 ).fill( '' ).fill( '', 0, arcade.health[ arcade.type ] + 1 ).join( '' )}` )

            const block = overworld.getBlock( { ...player.location, y: player.location.y - 1 } )
          
            if ( block ) if ( arcade.playing && arcade.health[ arcade.type ] < 9 && player.isInWater && this.ticks % 5 == 0 && player.getComponent( 'breathable' ).airSupply >= 15 ) {
                arcade.health[ arcade.type ] += 1
                player.runCommand( 'playsound fnaf.heal @s' )
            }
        }

        this.ticks++
        this.tick()
    } ) }
}

class Game {
    constructor() {
        this.usage = [ false, false, false, false, false ]
        this.state = false
        this.night = false
        this.button = false
        this.goldenFreddy = new GoldenFreddy()
        this.confetti = new Confetti()
        this.arcade = new arcadeStartup()
        this.cupcakeBoss = new CupcakeBoss()
        this.kingBooBoss = new KingBooBoss()
        this.race = new Race()
        this.settings = new Map( [
            [ 'freddy', 5 ],
            [ 'bonnie', 5 ],
            [ 'chica', 5 ],
            [ 'foxy', 5 ],
            [ 'cooldown', 5 ],
            [ 'no_fog', 0 ],
            [ 'weather', 0 ],
            [ 'free_roam', 0 ],
            [ 'no_walking', 0 ],
            [ 'camera_share', 0 ]
        ] )
    }
    start( freddy, bonnie, chica, foxy ) {
        this.state = true
        this.power = 100
        this.ticks = 0
        this.hum_ticks = 0
        this.buzz_ticks = 0
        this.powerdown = false
        this.lock = [ false, false ]
        this.usage = [ false, false, false, false, false ]
        this.animatronics = [ new Freddy( freddy ), new Bonnie( bonnie ), new Chica( chica ), new Foxy( foxy ) ]
        this.powerdownSetup = new PowerDown( ( 1 + Math.floor( Math.random() * 6 ) ) * 0.5 * 200, this.animatronics[ 0 ] )

        const coins = overworld.getEntities( { type: 'fnaf:coins' } ) 

        for ( const coin of coins ) {
            coin.runCommand( 'effect @s invisibility infinite 1 true' )
            if ( Math.random() > 0.5 ) coin.runCommand( 'effect @s clear' )
        }

        for ( const animatronic of game.animatronics ) {
            animatronic.entity.teleport( animatronic.location, { rotation: animatronic.rotation } )
            animatronic.entity.setProperty( 'fnaf:state', 0 )
            animatronic.ticks = 100 - game.settings.get( 'cooldown' ) * 20

            if ( [ ...players.values() ].map( player => !!player.team ).includes( true ) ) animatronic.autopilot = false
        }

        const tick = () => system.run( () => {
            // Usage subtracting power
            const usage = this.usage.map( tech => tech ? 1 : 0 ).reduce( ( a, b ) => a + b )

            if ( !this.powerdown ) this.power -= ( usage + 1 ) * 0.01
            
            // Powerdown
            if ( this.power <= 0 && !this.powerdown ) {
                this.powerdown = true
                this.power = 0

                for ( const animatronic of this.animatronics ) animatronic.entity.runCommand( 'effect @s invisibility infinite 1 true' )
                for ( const player of overworld.getPlayers().filter( player => players.has( player.name ) ? players.get( player.name ).cameraUsage : false ) ) exitCamera( player )

                const [ freddy ] = this.animatronics
                freddy.entity.runCommand( 'teleport @s -5 0 1 270 0' )

                if ( game.usage[ 0 ] ) executeDoor( 0, true )
                if ( game.usage[ 1 ] ) executeDoor( 1, true )
    
                game.usage = [ false, false, false, false, false ]

                runCommands(
                    'setblock -3 1 3 lever ["lever_direction"="east","open_bit"=false]',
                    'setblock -3 2 3 lever ["lever_direction"="east","open_bit"=false]',
                    'setblock 3 1 3 lever ["lever_direction"="west","open_bit"=false]',
                    'setblock 3 2 3 lever ["lever_direction"="west","open_bit"=false]',
                    'playsound fnaf.powerdown @a 0 1 1 100000',
                    'event entity @e[type=fnaf:fan] fan_stop',
                    'setblock 0 6 0 air',
                    'setblock 5 6 1 air',
                    'setblock -5 6 1 air',
                    'stopsound @a fnaf.hum',
                    'stopsound @a fnaf.buzz'
                )
        
                this.powerdownSetup.start()
            }

            // Actionbar for players
            for ( const player of world.getAllPlayers() ) {
                if ( !players.has( player.name ) ) continue

                const playerData = players.get( player.name )
                const animatronic = this.animatronics[ playerData.animatronic ]
                
                player.onScreenDisplay.setActionBar( `${
                    playerData.team == 1 ? `Location: ${
                        animatronic.currentLocation
                    }\nState: ${
                        animatronic.state
                    }\nCooldown: ${
                        ( x => x == 0 ? 'Can Move' : x )( 100 - animatronic.ticks )
                    }\nBeing Stalked: ${
                        [ ...players.values() ].filter( value => value.currentCamera == animatronic.currentLocation && value.cameraUsage ).length
                    }${
                        animatronic.currentLocation == 'office' || animatronic.currentLocation == 'stage-4' ? `\nAttack Delay: ${
                            ( x => x == 0 ? 'Can Attack' : x )( animatronic.attackDelay )
                        }` : ''
                    }${
                        animatronic instanceof Freddy || animatronic instanceof Foxy ? `\nStalling: ${
                            !!animatronic.cooldown
                        }` : ''
                    }${
                        ( players => !!players ? '\nControlling: ' + players : '' )( overworld.getPlayers().filter( filteredPlayer => {
                            if ( !players.has( filteredPlayer.name ) ) return false

                            const playerData = players.get( filteredPlayer.name )
                            
                            return playerData.team == 1 && playerData.animatronic == game.animatronics.indexOf( animatronic ) && filteredPlayer.name != player.name
                        } ).map( player => player.name ).join( '\n' ) )
                    }\n\n` : ''
                }${
                    Math.floor( this.ticks / 1200 ) == 0 ? '12' : Math.floor( this.ticks / 1200 )
                }:00 AM\nPower: ${
                    Math.floor( this.power )
                }%\nUsage: ${
                    this.powerdown ? '§r▋▋▋▋' : usage > 2 ? '§a▋§a▋§e▋§c▋' : usage > 1 ? '§a▋§a▋§e▋§r▋' : usage > 0 ? '§a▋§a▋§r▋▋' : '§a▋§r▋▋▋'
                }` )

                if ( playerData.cameraUsage ) player.teleport( { x: 0.5, y: 0, z: 1.5 }, { rotation: { x: 6, y: 180 } } )
                if ( !!game.settings.get( 'free_roam' ) ) {
                    const [ nearbyAnimatronic ] = overworld.getEntities( { location: player.location, maxDistance: 2, tags: [ 'Animatronic' ] } )
                    const typeId = [ 'fnaf:freddy', 'fnaf:bonnie', 'fnaf:chica', 'fnaf:foxy' ]

                    if ( nearbyAnimatronic ) {
                        this.powerdown = true
                        this.jumpscare( this.animatronics[ typeId.indexOf( nearbyAnimatronic.typeId ) ] )
                    }
                }
            }
            // Animatronic movement update
            if ( !this.powerdown ) for ( const robit of this.animatronics ) this.update( robit )

            // Door, light, and fan noise
            if ( this.hum_ticks % 175 == 0 && ( this.usage[ 2 ] || this.usage[ 3 ] ) ) for ( const player of overworld.getPlayers() ) player.playSound( 'fnaf.hum', { volume: 1000 } )
            if ( this.buzz_ticks % 180 == 0 && overworld.getEntities( { type: 'fnaf:fan' } )[ 0 ].getComponent( 'minecraft:variant' ).value == 1 ) for ( const player of overworld.getPlayers() ) player.playSound( 'fnaf.fan', { volume: 1000 } )
            if ( overworld.getEntities( { type: 'fnaf:fan' } )[ 0 ].getComponent( 'minecraft:variant' ).value == 1 ) { this.buzz_ticks++ } else { this.buzz_ticks = 0 }

            // Dust particle
            if ( this.ticks % 200 == 0 ) overworld.spawnParticle( 'dust_particle', { x: 5, y: 0, z: -22 } ) 

            // It's me
            if ( this.ticks % 20 == 0 ) if ( Math.random() < 0.001 ) for ( const player of overworld.getPlayers().filter( player => players.has( player.name ) ? players.get( player.name ).team == 0 : false ) ) {
                player.onScreenDisplay.setTitle( 'its_me' )
                player.runCommand( 'playsound fnaf.robot_voice @s 0 0 0' )
                system.runTimeout( () => player.runCommand( 'stopsound @s fnaf.robot_voice' ), 10 )
            }

            // Update light noise ticks
            if ( this.usage[ 2 ] || this.usage[ 3 ] ) { this.hum_ticks++ } else { this.hum_ticks = 0 }

            // 6 AM
            if ( this.ticks >= 7200 ) {
                for ( const player of overworld.getPlayers() ) {
                    const coins = this.animatronics.map( x => x.aiLevel ).reduce( ( x, y ) => x + y ) * 5

                    player.sendMessage( `You earned  ${coins} fazbear coins!` )
                    player.runCommand( 'playsound fnaf.chimes @s 0 0 0 100000' )
                    system.runTimeout( () => player.runCommand( 'playsound fnaf.crowd_small @s 0 0 0 100000' ), 140 )
                    player.onScreenDisplay.setTitle( '6 AM', { stayDuration: 120, fadeInDuration: 10, fadeOutDuration: 10 } )
                    world.scoreboard.getObjective( 'coins' ).addScore( player, coins )
                }
                return this.reset()
            }

            // Update ai level when playing on nights
            if ( this.night && this.ticks % 1200 == 0 ) if ( this.night.has( this.ticks / 1200 ) ) for ( const [ index, animatronic ] of this.animatronics.entries() ) {
                animatronic.aiLevel = this.night.get( this.ticks / 1200 )[ index ]
            }

            // Spectating animatronic for team 1
            for ( const player of overworld.getPlayers().filter( player => players.has( player.name ) ? players.get( player.name ).team == 1 : false ) ) {
                const playerData = players.get( player.name )
                const radius = !!playerData.perspective ? 0.4 : 2.8
                const animatronic = this.animatronics[ players.get( player.name ).animatronic ]
                const { x, y } = !!playerData.perspective ? animatronic.entity.getRotation() : player.getRotation()
                const animatronicLocation = animatronic.entity.location

                player.addEffect( 'minecraft:invisibility', 20, { showParticles: false } )
                player.camera.setCamera( 'minecraft:free', {
                    easeOptions: { easeTime: 0.1, easeType: 'InSine' },
                    location: {
                        x: animatronicLocation.x + ( radius * Math.sin( toRadians( ( !!playerData.perspective ? 360 : 180 ) - y ) ) ) * ( Math.cos( toRadians( x ) ) ),
                        y: animatronicLocation.y + ( !!playerData.perspective ? 3.7 : ( 2.5 + ( radius * Math.sin( toRadians( 180 - x ) ) ) ) ),
                        z: animatronicLocation.z + ( radius * Math.cos( toRadians( ( !!playerData.perspective ? 360 : 180 ) - y ) ) ) * ( Math.cos( toRadians( x ) ) )
                    },
                    rotation: !!playerData.perspective ? animatronic.entity.getRotation() : player.getRotation()
                } )

                if ( game.settings.get( 'free_roam' ) && !this.powerdown ) {
                    if ( animatronic.state == 'moving' ) {
                        const { x, y, z } = player.getViewDirection()

                        animatronic.entity.applyImpulse( { x: x * 0.08, y: y * 0.08, z: z * 0.08 } )
                        animatronic.entity.setRotation( player.getRotation() )
                    }
                    continue
                }

                if ( !this.state ) continue

                if ( animatronic.state == 'moving' ) {
                    player.runCommand( `replaceitem entity @s slot.hotbar 3 air 1 0 { "item_lock": { "mode": "lock_in_slot" } }` )
                    player.runCommand( `replaceitem entity @s slot.hotbar 5 air 1 0 { "item_lock": { "mode": "lock_in_slot" } }` )
                    continue
                }
                
                if ( animatronic.attack ) {
                    if ( animatronic instanceof Bonnie || animatronic instanceof Chica ) continue

                    player.runCommand( `replaceitem entity @s slot.hotbar 3 fnaf:kill 1 0 { "item_lock": { "mode": "lock_in_slot" } }` )
                    player.runCommand( `replaceitem entity @s slot.hotbar 5 air 1 0 { "item_lock": { "mode": "lock_in_slot" } }` )
                    continue
                }

                const [ first, second ] = animatronic.locations.get( animatronic.currentLocation ).map( x => x.name )

                player.runCommand( `replaceitem entity @s slot.hotbar 3 fnaf:${first} 1 0 { "item_lock": { "mode": "lock_in_slot" } }` )
                player.runCommand( `replaceitem entity @s slot.hotbar 5 ${second ? 'fnaf:' + second : 'air'} 1 0 { "item_lock": { "mode": "lock_in_slot" } }` )
            }

            this.ticks++
            if ( this.state ) tick()
        } )

        runCommands(
            'fill -5 0 2 -5 3 0 fnaf:reveal ["fnaf:rotation"="west"]',
            'fill -5 2 -2 -5 3 -4 fnaf:reveal ["fnaf:rotation"="west"]',
            'fill 5 0 2 5 3 0 fnaf:reveal ["fnaf:rotation"="east"]',
            'fill 5 2 -2 5 3 -4 fnaf:reveal ["fnaf:rotation"="east"]',
            'fill -4 0 2 -4 3 0 air',
            'fill 4 0 2 4 3 0 air',
            'setblock -3 1 3 lever ["lever_direction"="east","open_bit"=false]',
            'setblock -3 2 3 lever ["lever_direction"="east","open_bit"=false]',
            'setblock 3 1 3 lever ["lever_direction"="west","open_bit"=false]',
            'setblock 3 2 3 lever ["lever_direction"="west","open_bit"=false]',
            'setblock 0 6 0 redstone_block',
            'setblock 5 6 1 air',
            'setblock -5 6 1 air',
            'setblock 5 8 -57 air',
            'music play music.game 1 1 loop',
            game.settings.get( 'free_roam' ) ? 'structure load Cove5 -21 1 -29' : 'structure load Cove1 -21 1 -29'
        )

        if ( !game.settings.get( 'no_fog' ) ) overworld.runCommand( 'fog @a push fnaf:fog fog' )
        if ( game.settings.get( 'weather' ) ) overworld.runCommand( 'weather thunder 999999' )
        if ( game.settings.get( 'free_roam' ) ) runCommands(
            'fill -5 0 2 -5 3 -4 air',
            'fill 5 0 2 5 3 -4 air'
        )

        for ( const player of overworld.getPlayers() ) {
            if ( !players.has( player.name ) ) continue
            
            const playerData = players.get( player.name )
            
            if ( playerData.arcade.playing ) saveArcade( player, false )

            player.runCommand( `tp @s ${ [ '0 0 0 180 0', '0 0 -13 180 0' ][ playerData.team ] }` )

            if ( playerData.team == 1 ) {
                transferItems( player, 2, 6 )

                if ( game.settings.get( 'free_roam' ) ) {
                    player.runCommand( 'replaceitem entity @s slot.hotbar 3 fnaf:move 1 0 { "item_lock": { "mode": "lock_in_slot" } }' )
                    player.runCommand( 'replaceitem entity @s slot.hotbar 5 fnaf:interact 1 0 { "item_lock": { "mode": "lock_in_slot" } }' )
                }
                
                player.runCommand( 'replaceitem entity @s slot.hotbar 4 fnaf:animatronic_switch 1 0 { "item_lock": { "mode": "lock_in_slot" } }' )
                player.runCommand( 'replaceitem entity @s slot.hotbar 6 fnaf:perspective 1 0 { "item_lock": { "mode": "lock_in_slot" } }' )
                player.runCommand( 'replaceitem entity @s slot.hotbar 2 fnaf:pose 1 0 { "item_lock": { "mode": "lock_in_slot" } }' )
            }
        }

        for ( const location of [ '13 0 -20', '-20 0 -41', '-10 0 -8' ] ) executeEntityDoor( overworld.getBlock( vector3( ...location.split( ' ' ).map( Number ) ) ), false, true )
        for ( const location of [ '14 0 -44', '17 0 -44' ] ) executeEntityDoor( overworld.getBlock( vector3( ...location.split( ' ' ).map( Number ) ) ), false, false, true )

        tick()
    }
    update( robit ) {
        if ( !this.state ) return
        if ( robit.state != 'idle' ) return

        const playerData = [ ...players.values() ]
        const team = !playerData.map( player => !!player.team ).includes( true )

        if ( robit.attack ) switch ( true ) {
            case robit instanceof Bonnie || robit instanceof Chica:
                if ( robit.kill ) return this.checkDoor( robit )
                if ( robit.attackDelay > 0 ) return robit.attackDelay--
                if ( robit.attackDelay == 0 ) {
                    robit.attackDelay = 100
                    this.checkDoor( robit )
                }
                return
            case robit instanceof Freddy:
                if ( [ ...players.values() ].filter( player => player.cameraUsage ).map( player => player.currentCamera ).includes( 'east-hall-corner' ) ) robit.attackDelay = 100
                if ( robit.attackDelay > 0 ) return robit.attackDelay--
                if ( team && robit.attackDelay == 0 ) {
                    robit.attackDelay = 100
                    this.checkDoor( robit )
                }
                return
            case robit instanceof Foxy:
                if ( [ ...players.values() ].filter( player => player.cameraUsage ).map( player => player.currentCamera ).includes( 'west-hall' ) ) robit.attackDelay = 0
                if ( robit.attackDelay > 0 ) return robit.attackDelay--
                if ( team ) this.moveChances( robit, true )
                return
        }
        if ( robit instanceof Freddy || robit instanceof Foxy ) {
            robit.cooldown < 1 ? ( robit.ticks < 100 && robit.ticks++ ) : robit.cooldown--

            if ( robit instanceof Freddy ) if ( playerData.filter( player => player.cameraUsage ).map( player => player.currentCamera ).includes( robit.currentLocation ) ) robit.cooldown = 100
            if ( robit instanceof Foxy ) if ( playerData.map( player => player.cameraUsage ).includes( true ) ) robit.cooldown = 100
        } else {
            robit.ticks < 100 && robit.ticks++
        }
        if ( robit.autopilot ) if ( robit.ticks == 100 ) {
            robit.ticks = 100 - game.settings.get( 'cooldown' ) * 20
            this.moveChances( robit )
        }
    }
    moveChances( robit, force = false ) {
        if ( !force ) if ( !this.randomChance( robit.aiLevel, 20 ) ) return
        
        const arrayLocation = robit.locations.get( robit.currentLocation )

        this.move( robit, arrayLocation[ arrayLocation.length == 1 ? 0 : this.randomChance( 1, 2 ) ? 1 : 0 ] )
    }
    move( robit, newLocation ) {
        robit.entity.setProperty( 'fnaf:state', 1 )

        const animatronicTeam = overworld.getPlayers().filter( player => players.has( player.name ) ? players.get( player.name ).team == 1 : false )
        
        // Animatronic doing the deepstep except foxy
        if ( !( robit instanceof Foxy ) ) overworld.runCommand( `playsound fnaf.deepstep @a ${Object.values( robit.entity.location ).map( x => Math.floor( x ) ).join( ' ' )} 100000` )
        // Bonnie doing the swim animation
        if ( robit instanceof Bonnie && Math.random() <= 0.01 ) robit.entity.setProperty( 'fnaf:state', 4 )
        // Freddy doing the laugh
        if ( robit instanceof Freddy ) overworld.runCommand( `playsound fnaf.laugh_giggle @a 0 0 0 100000` )
        // Effect all animatronic except foxy and freddy invisibilty when going to the office
        if ( newLocation.name == 'office' && !( robit instanceof Foxy ) && !( robit instanceof Freddy ) ) robit.entity.runCommand( 'effect @s invisibility infinite 1 true' )
        // Play running sound at West Hall
        if ( newLocation.name == 'office' && robit instanceof Foxy ) overworld.runCommand( 'playsound fnaf.foxy_running @a -7 0 -15 100000' )
        // Announce animatronic teams that they moved an animatronic
        for ( const player of animatronicTeam ) player.sendMessage( `§s${robit.currentPlayer}§r moved ${robit.name} from ${robit.currentLocation} to ${newLocation.name}` )

        const animatronic = robit.entity
        const betterMovement = newLocation.movement
        const direction = newLocation.direction
        let a = 0

        robit.state = 'moving'

        for ( const [ index, coord ] of betterMovement.entries() ) {
        
            const movement = betterMovement.map( dist => Math.abs ( dist ) ).reduce( ( a, b ) => a + b )
    
            for ( let i = 0; i < ( Math.abs( coord ) ); i++ ) for ( let j = 0; j < 8; j++ ) system.runTimeout( () => {
                if ( !this.powerdown ) animatronic.teleport( { x: animatronic.location.x + ( ( direction + index ) % 2 == 0 ? ( coord > 0 ? 1 : -1 ) / 8 : 0 ), z: animatronic.location.z + ( ( direction + index ) % 2 == 0 ? 0 : ( coord > 0 ? 1 : -1 ) / 8 ), y: overworld.getBlock( { x: animatronic.location.x, y: animatronic.location.y - 0.19, z: animatronic.location.z } ).isAir ? animatronic.location.y - 0.2 : animatronic.location.y }, {
                    rotation: { x: 0, y: ( direction + index ) % 2 == 1 && coord > 0 ? 0 : ( direction + index ) % 2 == 0 && coord < 0 ? 90 : ( direction + index ) % 2 == 1 && coord < 0 ? 180 : 270 }
                } )
            }, ( !!game.settings.get( 'no_walking' ) && !( robit instanceof Foxy ) ? 0.1 : newLocation.speed ) * 20 / movement * ( j / 8 + i + a ) )
            
            a += Math.abs( coord )
        }

        system.runTimeout( () => {
            robit.state = 'idle'
            
            if ( this.powerdown ) return

            robit.currentLocation = newLocation.name
            robit.entity.setProperty( 'fnaf:state', newLocation.state )
            
            if ( !this.state ) return
            if ( robit instanceof Foxy ) switch ( newLocation.name ) {
                case 'stage-2':
                    overworld.runCommandAsync( 'structure load Cove2 -21 1 -29' ); break
                case 'stage-3':
                    overworld.runCommandAsync( 'structure load Cove3 -21 1 -29' ); robit.entity.runCommand( 'tp @s ~ 0 ~' );break
                case 'stage-4':
                    overworld.runCommandAsync( 'structure load Cove4 -21 1 -29' ) 
                    robit.attack = true; break
                case 'office': this.checkDoor( robit ); break
            }
            if ( ( robit instanceof Bonnie || robit instanceof Chica || robit instanceof Freddy ) && newLocation.name == 'office' ) robit.attack = true
        }, ( !!game.settings.get( 'no_walking' ) && !( robit instanceof Foxy ) ? 0.1 : newLocation.speed ) * 20 ) 
    }
    checkDoor( robit ) {
        const [ animatronicPlayer ] = overworld.getPlayers().filter( player => {
            if ( !players.has( player.name ) ) return false

            const playerData = players.get( player.name )

            return playerData.team == 1 && playerData.animatronic == game.animatronics.indexOf( robit )
        } )
        const animatronicTeam = overworld.getPlayers().filter( player => players.has( player.name ) ? players.get( player.name ).team == 1 : false )

        switch ( true ) {
            case robit instanceof Bonnie || robit instanceof Chica:
                if ( robit.kill ) { if ( [ ...players.values() ].map( player => player.cameraUsage ).includes( true ) ) {
                    this.jumpscare( robit )
                    this.lock = [ false, false ]
                }; return }
                if ( !this.randomChance( robit.aiLevel, 20 ) && !this.usage[ robit.door ] ) {
                    if ( animatronicPlayer ) animatronicPlayer.sendMessage( 'Chances of attacking failed' )
                    return
                }
                if ( this.usage[ robit.door ] ) {
                    robit.attack = false
                    robit.attackDelay = 100
                    robit.ticks = 100
                    robit.entity.runCommand( 'effect @s clear' )
                    for ( const player of animatronicTeam ) player.sendMessage( `§s${robit.currentPlayer}§r failed to attack as ${robit.name}` )
                } else {
                    this.lock[ robit.door ] = true
                    robit.kill = true
                    robit.attackDelay = 0
                    if ( animatronicPlayer ) animatronicPlayer.sendMessage( 'Awaiting distraction' )
                }
                break
            case robit instanceof Freddy:
                if ( !this.randomChance( robit.aiLevel, 20 ) ) {
                    if ( animatronicPlayer ) animatronicPlayer.sendMessage( 'Chances of attacking failed' )
                    return
                }
                if ( !this.usage[ robit.door ] ) return this.jumpscare( robit )
                for ( const player of animatronicTeam ) player.sendMessage( `§s${robit.currentPlayer}§r failed to attack as ${robit.name}` )
                overworld.runCommand( `playsound fnaf.laugh_giggle @a 0 0 0 0.7` )
                robit.attackDelay = 100
                break
            case robit instanceof Foxy:
                if ( this.usage[ robit.door ] ) {
                    robit.attack = false
                    robit.attackDelay = 100
                    robit.currentLocation = 'pirate-cove'
                    robit.entity.setProperty( 'fnaf:state', 0 )
                    robit.entity.teleport( robit.location, robit.rotation )
                    overworld.runCommandAsync( 'structure load Cove1 -21 1 -29' )
                    overworld.runCommand( 'playsound fnaf.knock @a -4 0 1 100000' )
                    for ( const player of animatronicTeam ) player.sendMessage( `§s${robit.currentPlayer}§r failed to attack as ${robit.name}` )
                } else {
                    this.jumpscare( robit )
                    overworld.runCommandAsync( 'structure load Cove1 -21 1 -29' )
                }
                break
        }
    }
    jumpscare( robit ) {
        this.state = false
        this.powerdown = true

        robit.entity.runCommand( 'effect @s clear' )
        robit.entity.addEffect( 'minecraft:invisibility', 10, { showParticles: false } )
        robit.entity.setProperty( 'fnaf:state', 2 )
        robit.entity.teleport( { x: 0.5, y: 0, z: 0.5 }, { rotation: { x: 0, y: 0 } } )

        for ( const player of overworld.getPlayers().filter( player => players.has( player.name ) ? players.get( player.name ).team == 1  : false ) ) {
            players.get( player.name ).animatronic = this.animatronics.indexOf( robit )
            player.setRotation( { x: -15, y: 180 } )
        }
        for ( const player of overworld.getPlayers().filter( player => players.has( player.name ) ? players.get( player.name ).team == 0 : false ) ) if ( players.get( player.name ).cameraUsage ) exitCamera( player )

        system.runTimeout( () => {
            for ( const player of overworld.getPlayers().filter( player => players.has( player.name ) ? players.get( player.name ).team == 0 : false ) ) {
                player.resetLevel()
                player.teleport( { x: 0.5, y: 0, z: 2.5 }, { rotation: { x: -20, y: 180 } } )
                player.addEffect( 'minecraft:invisibility', 25, { showParticles: false } )
                player.playSound( 'fnaf.scream', { location: { x: 0, y:0, z: 2 }, volume: 100000 } )
                player.runCommand( 'camerashake add @s 0.2 1.25 rotational' )
                player.runCommand( 'inputpermission set @s camera disabled' )
                player.runCommand( 'inputpermission set @s movement disabled' )
            }

            robit.entity.playAnimation( 'jumpscare' )

            system.runTimeout( () => {
                const [ suit ] = overworld.getEntities( { type: 'fnaf:freddy_suit', maxDistance: 3, location: { x: -25, y: 1, z: -37 } } )
                const [ endo ] = overworld.getEntities( { type: 'fnaf:endoskeleton', maxDistance: 3, location: { x: -25, y: 1, z: -37 } } )
                const player = ( players => players[ Math.floor( Math.random() * players.length ) ] )( overworld.getPlayers().filter( player => players.has( player.name ) ? players.get( player.name ).team == 0 : false ) )

                suit.removeEffect( 'minecraft:invisibility' )
                endo.addEffect( 'minecraft:invisibility', 240, { showParticles: false } )

                if ( player ) for ( const [ index, rotation ] of [ -45, 45, 0 ].entries() ) system.runTimeout( () => { player.teleport( suit.location, { rotation: { x: 0, y: rotation } } ) }, 5 * index )

                for ( const player of overworld.getPlayers() ) {
                    if ( !players.has( player.name ) ) continue

                    player.resetLevel()
                    player.addLevels( 14 )
                    player.runCommand( 'stopsound @s fnaf.scream' )
                    player.runCommand( 'playsound fnaf.game_over' )
                    player.sendMessage( robit.currentPlayer ? `§s${robit.currentPlayer}§r killed the security guard as ${robit.name}` : `Security guard got killed by ${robit.name}` )

                    system.runTimeout( () => {
                        player.resetLevel()

                        const { x, y, z, roty, rotx, ui } = cameraLocation[ 3 ]
                        player.camera.setCamera( 'minecraft:free', {
                            easeOptions: { easeTime: 0, easeType: 'Linear' },
                            location: { x, y, z },
                            rotation: { x: rotx, y: roty }
                        } )
                        player.addLevels( ui )

                        if ( Math.random() < 0.1 ) {
                            player.onScreenDisplay.setTitle( 'git_gud' )
                            player.runCommand( 'playsound fnaf.git_gud @s ~~~ 100000' )
                        }

                        system.runTimeout( this.reset, 180 )
                    }, 20 ) 
                }
            }, 25 )
        }, 10 )
    }
    randomChance( weight, totalWeight ) {
        return Math.random() * totalWeight < weight ? true : false
    }
    reset() {
        game.powerdown = false
        game.state = false

        const checkRobitIsMoving = () => system.runTimeout( () => {
            const win = game.ticks >= 7200

            if ( game.animatronics instanceof Array ) {
                if ( !game.settings.get( 'free_roam' ) || ![ ...players.values() ].map( player => player.team ).includes( 1 ) ) if ( game.animatronics.map( robit => robit.state ).includes( 'moving' ) ) return checkRobitIsMoving()
                
                for ( const animatronic of game.animatronics ) {
                    if ( animatronic instanceof Freddy ) animatronic.entity.setProperty( 'fnaf:lit_eye', false )

                    animatronic.entity.teleport( animatronic.location, { rotation: animatronic.rotation } )
                    animatronic.entity.setProperty( 'fnaf:state', 3 )
                    if ( win ) this.animatronics[ 0 ].entity.setProperty( 'fnaf:state', 8 ) 
                    animatronic.entity.runCommand( 'effect @s clear' )
                }
            }

            for ( const player of overworld.getPlayers() ) {
                player.runCommand( 'fog @s remove fog' )
                player.resetLevel()
                player.camera.clear()
    
                player.runCommand( 'inputpermission set @s camera enabled' )
                player.runCommand( 'inputpermission set @s movement enabled' )
    
                player.teleport( { x: 0.5, y: 0, z: -39.5 }, { rotation: { x: 0, y: 180 } } )
            }

            for ( const location of [ '14 0 -44', '17 0 -44' ] ) executeEntityDoor( overworld.getBlock( vector3( ...location.split( ' ' ).map( Number ) ) ), false, null, false )
    
            runCommands(
                'structure load Cove5 -21 1 -29',
                'fill -5 0 2 -5 3 -4 air',
                'fill 5 0 2 5 3 -4 air',
                'setblock 5 8 -57 redstone_block',
                'setblock 0 6 0 redstone_block',
                'weather clear',
                'music play fnaf.lobby 1 1 loop',
                'effect @e[type=fnaf:freddy_suit] invisibility infinite 1 true',
                'replaceitem entity @a slot.hotbar 2 air',
                'replaceitem entity @a slot.hotbar 3 air',
                'replaceitem entity @a slot.hotbar 4 air',
                'replaceitem entity @a slot.hotbar 5 air',
                'replaceitem entity @a slot.hotbar 6 air',
            )
            
            worldTick.start()
            if ( win ) this.confetti.start( vector3( 0, 0, -40 ) )
        }, 20 )
        checkRobitIsMoving()
    }
}

const players = new Map()
const game = new Game()
const worldTick = new WorldTick()
const cameraLocation = [
    { name: 'main-stage',       x:   0, y: 6.5, z: -40, roty: 180, rotx: 25 , ui: 2  },
    { name: 'dining-area',      x:   0, y: 6.5, z: -23, roty: 180, rotx: 35 , ui: 3  },
    { name: 'pirate-cove',      x: -16, y: 6.5, z: -25, roty:  90, rotx: 25 , ui: 4  },
    { name: 'back-stage',       x: -21, y: 4.5, z: -34, roty: 140, rotx: 30 , ui: 5  },
    { name: 'restroom',         x:  21, y: 4.5, z: -21, roty: 200, rotx: 30 , ui: 6  },
    { name: 'kitchen',          x:  11, y: 4.5, z:  -7, roty: 225, rotx: -90, ui: 7  },
    { name: 'supply-closet',    x: -11, y: 4.5, z:  -4, roty: 135, rotx: 40 , ui: 8  },
    { name: 'west-hall',        x:  -7, y: 4.5, z:  -8, roty: 180, rotx: 25 , ui: 9  },
    { name: 'west-hall-corner', x:  -5, y: 4.5, z:   1, roty:  45, rotx: 35 , ui: 11 },
    { name: 'east-hall',        x:   7, y: 4.5, z:  -8, roty: 180, rotx: 25 , ui: 12 },
    { name: 'east-hall-corner', x:   5, y: 4.5, z:   1, roty: -45, rotx: 35 , ui: 13 }
]

for ( const player of world.getAllPlayers() ) players.set( player.name, new PlayerData() )

worldTick.start()

world.afterEvents.playerJoin.subscribe( event => {
    const checkPlayer = playerName => {
        if ( !world.getPlayers().map( player => player.name ).includes( playerName ) ) return system.runTimeout( () => checkPlayer( playerName ), 20 )
        if ( playerName == overworld.getPlayers()[ 0 ].name ) world.playMusic( 'fnaf.spooky', { loop: true, fade: 1 } )

        const player = overworld.getPlayers().find( player => player.name == event.playerName )
        const scoreboard = world.scoreboard.getObjective( 'coins' )

        if ( !scoreboard.hasParticipant( player ) ) scoreboard.setScore( player, 0 )
        if  ( game.state || !!player.runCommand( 'testfor @s[x=0,y=0,z=-13,r=3]' ).successCount ) player.runCommand( 'tp @s 0 0 0' )

        player.runCommand( !game.settings.get( 'no_fog' ) && game.state ? 'fog @s push fnaf.fog fog' : 'fog @s remove fog' )
        player.runCommand( 'effect @s saturation infinite 1 true' )
        player.resetLevel()

        players.set( playerName, new PlayerData() )
    }
    checkPlayer( event.playerName )
} )

world.afterEvents.entityHurt.subscribe( event => {
    switch ( event.hurtEntity.typeId ) {
        case 'minecraft:player':
            const player = event.hurtEntity
            const playerData = players.get( player.name )

            event.hurtEntity.getComponent( 'health' ).resetToDefaultValue()

            if ( event.damageSource.cause == 'fireTick' ) player.extinguishFire()
            if ( !playerData.arcade.playing ) return

            playerData.arcade.health[ playerData.arcade.type ] -= 1

            if ( playerData.arcade.health[ playerData.arcade.type ] < 0 || ( event.damageSource.cause == 'fall' && player.location.y < 55 && !playerData.arcade.type && !game.arcade.boss ) ) {
                playerData.arcade.health[ playerData.arcade.type ] = 9

                if ( game.arcade.boss ) {
                    player.onScreenDisplay.setTitle( 'you_died', { fadeInDuration: 10, stayDuration: 10, fadeOutDuration: 10 } )

                    if ( playerData.arcade.type == 0 ) player.teleport( { x: 800.5, y: 0, z: 800.5 }, { rotation: { x: 0, y: 180 } } )
                    if ( playerData.arcade.type == 1 ) player.teleport( { x: -615.5, y: 32, z: -864.5 }, { rotation: { x: 0, y: 67 } } )

                    return
                }

                playerData.arcade.played[ playerData.arcade.type ] = false
                playerData.arcade.playing = false

                player.runCommand( 'fog @s remove fog' )
                player.runCommand( 'effect @s clear resistance' )
                player.runCommand( 'replaceitem entity @s slot.hotbar 4 air 1 0 { "item_lock": { "mode": "lock_in_slot" } }' )
                
                player.onScreenDisplay.setTitle( 'you_died', { fadeInDuration: 10, stayDuration: 20, fadeOutDuration: 10 } )
                system.runTimeout( () => player.teleport( { x: playerData.arcade.type ? -16 : -13, y: 0, z: -22.5 }, { rotation: { x: 0, y: 0 } } ), 10 )
            } 
            break
    }
} )

world.afterEvents.leverAction.subscribe( event => {
    const { x, y, z } = event.block.location
    const powered = !event.isPowered

    switch( true ) {
        case x == -3 && y == 2 && z == 3: 
            if ( game.state ) if ( ( !game.usage[ 0 ] && game.lock[ 0 ] ) || game.powerdown ) return overworld.runCommand( 'playsound fnaf.door_error @a -4 0 1 100000000' )

            executeDoor( 0, powered )

            if ( game.state ) game.usage[ 0 ] = !powered
            break
        case x == -3 && y == 1 && z == 3:
            if ( !game.state ) return
            if ( ( !game.usage[ 2 ] && game.lock[ 0 ] ) || game.powerdown || !game.state ) return overworld.runCommand( 'playsound fnaf.door_error @a -4 0 1 100000000' )
            
            overworld.runCommandAsync( `setblock -5 6 1 ${!powered ? 'redstone_block' : 'air'}` )
            game.usage[ 2 ] = !powered

            if ( game.animatronics[ 1 ].currentLocation == 'office' && !powered && game.animatronics[ 1 ].state == 'idle' ) {
                game.animatronics[ 1 ].entity.runCommand( 'effect @s clear' )
                overworld.runCommand( 'playsound fnaf.window_scare @a -4 2 -3 100000000' )
            }
            if ( powered && !( game.usage[ 2 ] || game.usage[ 3 ] ) ) for ( const player of overworld.getPlayers() ) player.runCommandAsync( 'stopsound @a fnaf.hum' )
            break
        case x == 3 && y == 2 && z == 3: 
            if ( game.state ) if ( ( !game.usage[ 1 ] && game.lock[ 1 ] ) || game.powerdown ) return overworld.runCommand( 'playsound fnaf.door_error @a 4 0 1 100000000' )

            executeDoor( 1, powered )

            if ( game.state ) game.usage[ 1 ] = !powered
            break
        case x == 3 && y == 1 && z == 3:
            if ( !game.state ) return
            if ( ( !game.usage[ 3 ] && game.lock[ 1 ] ) || game.powerdown ) return overworld.runCommand( 'playsound fnaf.door_error @a 4 0 1 100000000' )
            
            overworld.runCommandAsync( `setblock 5 6 1 ${!powered ? 'redstone_block' : 'air'}` )
            game.usage[ 3 ] = !powered
            
            if ( game.animatronics[ 2 ].currentLocation == 'office' && !powered && game.animatronics[ 2 ].state== 'idle' ) {
                game.animatronics[ 2 ].entity.runCommand( 'effect @s clear' )
                overworld.runCommand( 'playsound fnaf.window_scare @a 4 2 -3 100000000' )
            }
            if ( powered && !( game.usage[ 2 ] || game.usage[ 3 ] ) ) for ( const player of overworld.getPlayers() ) player.runCommandAsync( 'stopsound @a fnaf.hum' )
            break
    }
} )

class PaperBallGame {
    constructor() {
        this.ticks = 0
        this.active = false
    }
    start( player ) {
        if ( this.active ) return this.ticks = 0

        this.ticks = 0
        this.active = true
        this.player = player
        this.loop()
    }
    loop() {
        system.run( () => {
            const [ paperBall ] = overworld.getEntities( { type: 'fnaf:paper_ball', maxDistance: 0.5, location: { x: 3.5, y: 0, z: -1.5 } } )

            if ( paperBall ) {
                world.scoreboard.getObjective( 'coins' ).addScore( this.player, 10 )
                this.player.sendMessage( 'You earned 10 fazbear coins!' )

                overworld.runCommand( 'playsound fnaf.laugh_giggle_girl @a 0 0 0 100000' )
                paperBall.teleport( { x: 2.5, y: 0, z: -1.5 } )
            }
            
            this.ticks++

            if ( this.ticks % 60 == 0 ) this.active = false
            if ( this.active ) this.loop()
        } )
    }
}

const paperBallGame = new PaperBallGame()

world.afterEvents.entityHitEntity.subscribe( event => {
    switch ( event.hitEntity.typeId ) {
        case 'fnaf:paper_ball':
            event.hitEntity.applyImpulse( {
                x: event.damagingEntity.getViewDirection().x,
                y: 0.5,
                z: event.damagingEntity.getViewDirection().z
            } )
            paperBallGame.start( event.damagingEntity )
            break
        case 'fnaf:king_boo': game.kingBooBoss.attack(); break
    }
} )

class Item {
    constructor( price, typeId, name, icon = false, plush = false ) {
        this.price = price
        this.typeId = typeId
        this.name = name
        this.icon = icon
        this.plush = plush
    }
}

world.afterEvents.playerInteractWithEntity.subscribe( event => {
    const plush = ( red, green, blue ) => {
        const molangVariableMap = new MolangVariableMap()

        molangVariableMap.setColorRGB( 'variable.color', { red, green, blue } )

        const commands = new Map( [
            [ 'fnaf:freddy_plush', [ 'fnaf.laugh_giggle', 3 ] ],
            [ 'fnaf:chica_plush', [ 'fnaf.chica_breathing', 2 ] ],
            [ 'fnaf:foxy_plush', [ 'fnaf.foxy_idle', 2 ] ]
        ] )

        if ( commands.has( event.target.typeId ) && Math.random() <= 0.1 ) {
            const [ id, pitch ] = commands.get( event.target.typeId )

            event.player.runCommand( `playsound ${id} @s ~~~ 1 ${pitch}` )
        } else { event.player.runCommand( 'playsound fnaf.plushie @s' ) }

        event.target.playAnimation( 'interact' )
        overworld.spawnParticle( 'fnaf.sparkle', event.target.location, molangVariableMap )
    }

    switch ( event.target.typeId ) {
        case 'minecraft:llama':
            const player = event.player
            const form = new ActionFormData
            const scoreboard = world.scoreboard.getObjective( 'coins' )
            const [ armorstand ] = overworld.getEntities( { type: 'minecraft:armor_stand', tags: [ 'Data' ] } )
            const database = new Map( JSON.parse( armorstand.nameTag ) )
            const items = [
                new Item( -1, 'air', 'Remove Helmet' ),
                new Item( 0, 'fnaf:security_uniform', 'Uniform', 'security_uniform' ),
                new Item( 200, 'fnaf:freddy_mask', 'Freddy Head', 'freddy' ),
                new Item( 200, 'fnaf:bonnie_mask', 'Bonnie Head', 'bonnie' ),
                new Item( 200, 'fnaf:chica_mask', 'Chica Head', 'chica' ),
                new Item( 200, 'fnaf:foxy_mask', 'Foxy Head', 'foxy' ),
                new Item( 300, 'summon fnaf:freddy_plush -1.5 1 -3.5 -45', 'Freddy Plush', 'freddy_plush', true ),
                new Item( 300, 'summon fnaf:bonnie_plush -0.5 1 -3.5', 'Bonnie Plush', 'bonnie_plush', true ),
                new Item( 300, 'summon fnaf:chica_plush 1.5 1 -3.5', 'Chica Plush', 'chica_plush', true ),
                new Item( 300, 'summon fnaf:foxy_plush 2.5 1 -3.5 45', 'Foxy Plush', 'foxy_plush', true )
            ]

            if ( !database.has( player.name ) ) {
                database.set( player.name, [] )
                armorstand.nameTag = JSON.stringify( [ ...database.entries() ] )
            }
                
            for ( const index of database.get( player.name ) ) items[ index ].price = -1
    
            form.title( 'Shop' )
            form.body( `Buying a head will replace the head slot and lock it. Plushies will spawn into your office.\n\nYour currency: ${scoreboard.getScore( player )} fazbear coins\n\n` )

            for ( const item of items ) form.button( `${item.name} ${item.price < 0 ? '' : item.price > 0 ? ` ${item.price}` : 'Free'}`, item.icon ? `textures/items/${item.icon}` : '' )
    
            player.runCommand( 'tp @s 0 0 -21 0 0' )
            overworld.runCommand( 'tp @e[type=llama,name="lu"] 0.5 0 -18.5 180 0' )
            form.show( player ).then( response => {
                if ( response.canceled ) return
    
                const item = items[ response.selection ]

                if ( item.plush ) {
                    const [ plush ] = overworld.getEntities( { type: item.typeId.split( ' ' )[ 1 ], location: { x: 0.5, y: 1, z: -3.5 }, maxDistance: 2.5 } ) 

                    if ( plush ) return player.sendMessage( 'Item is already bought' )
                }
    
                if ( item.price >= 0 ) if ( scoreboard.getScore( player ) < item.price ) return player.sendMessage( 'Not enough fazbear coins!' )
                if ( item.price >= 0 ) scoreboard.setScore( player, scoreboard.getScore( player ) - item.price )

                if ( item.plush ) {
                    overworld.runCommand( item.typeId )
                    for ( const overworldPlayer of overworld.getPlayers() ) overworldPlayer.sendMessage( `§s${player.name}§r bought a ${item.name}!` )
                    return
                }
                
                player.runCommand( `replaceitem entity @s slot.armor.head 0 ${item.typeId} 1 0 { "item_lock": { "mode": "lock_in_slot" } }` )
    
                const [ armorstand ] = overworld.getEntities( { type: 'minecraft:armor_stand', tags: [ 'Data' ] } )
                const database = new Map( JSON.parse( armorstand.nameTag ) )

                if ( !database.get( player.name ).includes( response.selection ) ) database.get( player.name ).push( response.selection )
                
                armorstand.nameTag = JSON.stringify( [ ...database.entries() ] )
            } )
            break
        case 'fnaf:fan':
            if ( game.powerdown ) {
                overworld.runCommand( 'playsound fnaf.door_error @a 3 1 -4 100000000' )
                event.target.triggerEvent( 'fan_stop' )
            }
            
            const [ paperWall ] = overworld.getEntities( { location: { x: 1.5, y: 2.5, z: -4.5 }, maxDistance: 1, type: 'fnaf:paper_wall' } )

            paperWall.setProperty( 'fnaf:move', !!event.target.getComponent( 'minecraft:variant' ).value )
            break
        case 'fnaf:coins':
            if ( !event.target.getEffect( 'minecraft:invisibility' ) ) {
                const scoreboard = world.scoreboard.getObjective( 'coins' )

                event.target.runCommand( 'effect @s invisibility infinite 1 true' )
                event.player.runCommand( 'playsound fnaf.coin @s' )
                event.player.sendMessage( `You collected  5 fazbear coins!` )
                scoreboard.addScore( event.player, 5 )
            }
            break
        case 'fnaf:freddy_plush': plush( 0.682353, 0.482353, 0.356863 ); break;
        case 'fnaf:bonnie_plush': plush( 0.360784, 0.435294, 0.580392 ); break;
        case 'fnaf:chica_plush': plush( 0.913725, 0.772549, 0.235294 ); break;
        case 'fnaf:foxy_plush': plush( 0.490196, 0.192157, 0.176471 ); break;
        case 'fnaf:candy':
            const candyItem = [ 'fnaf:candy', 'fnaf:chocolate', 'fnaf:candy_corn' ][ event.target.getProperty( 'fnaf:type' ) ]

            event.player.runCommand( `give @s ${candyItem}` )
            event.target.triggerEvent( 'fnaf:instant_despawn' )
            break
    }
} )

world.afterEvents.buttonPush.subscribe( event => {
    const locationString = Object.values( event.block.location ).join( ' ' )

    if ( locationString == '849 67 784' ) {
        if ( !game.arcade.boss ) game.cupcakeBoss.start()
        return
    }
    if ( locationString == '-635 33 -857' ) {
        if ( !game.arcade.boss ) game.kingBooBoss.start()
        return
    }

    const buttonLocations = [
        '-57 2 -74',
        '-58 1 -94',
        '-51 2 -109',
        '-33 1 -107',
        '-19 2 -108',
        '-1 2 -107',
        '20 2 -107',
        '37 1 -107',
        '51 2 -107',
        '67 2 -104'
    ]

    if ( !buttonLocations.includes( locationString ) ) return
    if ( event.block.permutation.getState( 'facing_direction' ) < 2 ) return

    const doorFacingDirection = event.block.permutation.getState( 'facing_direction' ) - 2
    const direction = [ [ 1, 1, 0 ], [ -1, -1, 0 ], [ 1, -1, 1 ], [ -1, 1, 1 ] ][ doorFacingDirection ]
    const facing = [ 2, 0, 1, 3 ][ doorFacingDirection ]
    const { x, y, z } = event.block.center()
    const [ x2, z2, left ] = direction

    const chimes = [
        [ [ 'chime', Math.floor( Math.random() * 25 ), 0 ] ],
        [ [ 'chime', 14, 0 ], [ 'chime', 14, 6 ], [ 'chime', 15, 6 ], [ 'chime', 12, 6 ], [ 'chime', 10, 12 ] ],
        [ [ 'harp', 23, 2 ], [ 'pling', 16, 0 ], [ 'harp', 4, 6 ], [ 'pling', 19, 0 ], [ 'basedrum', 11, 0 ], [ 'harp', 16, 6 ], [ 'harp', 4, 6 ], [ 'pling', 21, 0 ], [ 'snare', 11, 0 ], [ 'harp', 16, 6 ], [ 'pling', 18, 0 ], [ 'basedrum', 11, 0 ], [ 'harp', 6, 6 ], [ 'basedrum', 11, 0 ], [ 'harp', 18, 6 ], [ 'harp', 6, 6 ], [ 'snare', 11, 0 ], [ 'harp', 18, 6 ], [ 'pling', 16, 0 ], [ 'harp', 7, 6 ], [ 'pling', 19, 0 ], [ 'basedrum', 11, 0 ], [ 'harp', 19, 6 ], [ 'pling', 16, 0 ], [ 'snare', 11, 0 ], [ 'harp', 7, 6 ], [ 'pling', 17, 0 ], [ 'snare', 11, 0 ], [ 'pling', 16, 4 ], [ 'harp', 19, 4 ], [ 'pling', 20, 4 ], [ 'harp', 8, 2 ], [ 'basedrum', 11, 0 ], [ 'harp', 20, 6 ], [ 'pling', 17, 0 ], [ 'harp', 8, 6 ], [ 'pling', 17, 0 ], [ 'snare', 11, 0 ], [ 'pling', 16, 4 ], [ 'harp', 20, 2 ], [ 'pling', 14, 4 ], [ 'harp', 9, 2 ], [ 'basedrum', 11, 0 ], [ 'pling', 12, 4 ], [ 'harp', 21, 2 ], [ 'harp', 9, 6 ], [ 'snare', 11, 0 ], [ 'pling', 12, 2 ], [ 'harp', 21, 4 ], [ 'pling', 12, 0 ], [ 'pling', 11, 4 ], [ 'harp', 0, 2 ], [ 'basedrum', 11, 0 ], [ 'harp', 12, 6 ], [ 'pling', 12, 0 ], [ 'harp', 11, 6 ], [ 'snare', 11, 0 ], [ 'bass', 11, 0 ], [ 'harp', 11, 6 ], [ 'pling', 9, 0 ], [ 'pling', 9, 4 ], [ 'bass', 16, 2 ], [ 'basedrum', 11, 0 ], [ 'harp', 16, 6 ], [ 'pling', 7, 0 ], [ 'bass', 16, 6 ], [ 'snare', 11, 0 ], [ 'harp', 16, 6 ], [ 'harp', 6, 6 ], [ 'basedrum', 11, 0 ], [ 'harp', 18, 6 ], [ 'harp', 11, 6 ], [ 'snare', 11, 0 ] ]
    ][ Math.random() >= 0.2 ? 0 : Math.floor( Math.random() * 2 ) + 1 ]

    for ( const [ index, [ note, pitch ] ] of chimes.entries() ) system.runTimeout( () => {
        event.source.runCommand( `playsound note.${note} @s ~~~ 1 ${Math.pow( 2, ( pitch - 12 ) / 12 )}` )
    }, chimes.slice( 0, index + 1 ).map( ( a ) => a[ 2 ] ).reduce( ( a, b ) => a + b ) ) 

    const door = overworld.getBlock( { x: x + x2 * ( !left ? 2 : 1 ), y: y - 1, z: z + z2 * ( left ? 2 : 1 ) } )
    const summonCandy = ( double = false ) => {
        const trick = Math.random() <= 0.3 ? true : false
        const candy = overworld.spawnEntity( trick ? [ 'minecraft:tropicalfish', 'minecraft:creeper', 'minecraft:spider', 'minecraft:chicken', 'minecraft:slime' ][ Math.floor( Math.random() * 3 ) ] : 'fnaf:candy', { x: x + x2 * ( left ? trick ? 1 : 2 : 1 ) + x2 * ( double && !left ? 0.5 : 0 ), y: y - 0.5, z: z + z2 * ( !left ? trick ? 1 : 2 : 1 ) + z2 * ( double && left ? 0.5 : 0 ) } )
    
        if ( !trick ) candy.setProperty( 'fnaf:type', [ 0, 1, 2 ][ Math.floor( Math.random() * 3 ) ] )
        candy.setRotation( { x: 0, y: facing * 90 } )
    
        const viewDirection = candy.getViewDirection()
                        
        candy.applyKnockback( viewDirection.x, viewDirection.z, 2, 0 )
    } 

    if ( door.typeId == 'minecraft:dark_oak_door' ) {
        system.runTimeout( () => door.setPermutation( BlockPermutation.resolve( 'minecraft:dark_oak_door', { open_bit: true, direction: door.permutation.getState( 'direction' ) } ) ), 1 )
        system.runTimeout( () => door.setPermutation( BlockPermutation.resolve( 'minecraft:dark_oak_door', { open_bit: false, direction: door.permutation.getState( 'direction' ) } ) ), 30 )

        return system.runTimeout( () => summonCandy( true ), 1 )
    }
    
    system.runTimeout( () => summonCandy(), 1 )
} )

// Update block/entity properties
world.afterEvents.itemUse.subscribe( event => {
    switch ( event.itemStack.typeId ) {
        case 'minecraft:stick':
            // game.kingBooBoss.roll()

            // event.source.runCommand( `setblock ${Object.values( event.source.getBlockFromViewDirection().block.location ).join( ' ' )} dripstone_block` )


            // const player = overworld.getPlayers()[0]

            // game.race.addPlayer( player, 5 )

            // game.race.start()

            // for ( const player of overworld.getPlayers() ) {
            //     const location = player.getRotation()

            //     player.applyKnockback( location.x * 0.2, location.z * 0.2, 1 )
            // }


            // const location = event.source.getBlockFromViewDirection().block.bottomCenter()

            // overworld.getPlayers()[0].sendMessage( Object.values( location ).join( ' ' ) )

            // const car = overworld.spawnEntity( 'fnaf:car', { ...location, y: location.y + 1 } )

            // car.getComponent( 'color' ).value = Math.floor( Math.random() * 16 )
            // car.getComponent( 'movement' ).setCurrentValue( 0.3 )

            

            // const rot = event.source.getViewDirection()
            // event.source.applyKnockback( rot.x * 2, rot.z * 2, 1, 0.5 )
            // const cupcake = new CupcakeBoss()
            // cupcake.start()

            // event.source.getComponent( 'inventory' ).container.transferItem( 0, overworld.getEntities( { type: 'fnaf:lost_and_found' } )[ 0 ].getComponent( 'inventory' ).container )
            // const musicDisc = new ItemStack('fnaf:music_disc', 1)
            // musicDisc.nameTag = 'Henlo'
            // musicDisc.setLore( [ 'The Living Tombstone - FNAF 1 Song' ] )
            
            // event.source.getComponent( 'inventory' ).container.setItem( 1, musicDisc )

            // pla

            // console.warn( Object.entries( overworld.getBlock( { x: 0, y: 0, z: -2 } ).permutation.getAllStates() ).map( ( [ key, value ] ) => `${key}: ${value}` ).join( '\n' ) ) 


            const [ mob ] = overworld.getEntities( { maxDistance: 3, type: 'fnaf:chica', location: event.source.location } )

            if ( mob ) mob.setProperty( 'fnaf:state', ( parseInt( mob.getProperty( 'fnaf:state' ) ) + 1 ) % 6 )
            // if ( mob ) mob.setProperty( 'fnaf:texture', ( parseInt( mob.getProperty( 'fnaf:texture' ) ) + 1 ) % 7 )
            // console.warn( mob?.typeId )
            // if ( mob ) mob.setProperty( 'fnaf:mirrored', !mob.getProperty( 'fnaf:mirrored' ) )
            // if ( mob ) mob.setProperty( 'fnaf:type', 'parkour' )

            break
    }
} )