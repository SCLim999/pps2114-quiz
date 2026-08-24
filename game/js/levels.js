/* ============================================================================
   BIT BUILDER — Level data
   ----------------------------------------------------------------------------
   Every level is an ASCII map. One character = one tile.

   LEGEND
     ' '  floor                     '#'  wall / server rack
     'P'  technician (start)        'O'  pushable crate
     'c'  HARDWARE part             's'  SOFTWARE part
     'S'  assembly socket (opens only when every part is collected)
     'X'  power button (level exit)
     '+'  help terminal (shows the level hint)
     '~'  coolant spill  (deadly without the Coolant Seal)
     '*'  overheat zone  (deadly without the Heatsink)
     '.'  cryo ice       (you slide unless you wear Grip Pads)
     '1'  ice corner NW   '2' ice corner NE   '3' ice corner SE   '4' ice corner SW
     '<' '>' '^' 'v'  data bus — carries you along unless you wear Mag Grips
     '!'  power-surge trap (one-shot: destroys whatever steps on it)
     'T'  scrubber — wipes every tool from your belt (access cards survive)
     '0'  network port (teleporter — throws you out of the next port)
     'k'  toggle switch  '-' toggle wall (solid)  '|' toggle wall (open)
     'r' 'b' 'y' 'g'  access cards  (red / blue / yellow / GREEN = root, reusable)
     'R' 'B' 'Y' 'G'  locked ports  (matching colour)
     'F'  Coolant Seal   'H' Heatsink   'K' Grip Pads   'M' Mag Grips
     '@'  Bug (hugs the left wall)      '%' Glitch (hugs the right wall)
     '&'  Trojan (hunts you)            '$' Packet (flies straight, bounces)
   ========================================================================== */

const LEVELS = [
  {
    name: "Boot Camp",
    hint: "Collect every hardware and software part, then walk through the assembly socket to the power button.",
    time: 120,
    map: [
      "###############",
      "#P    #   c   #",
      "# ### #  ###  #",
      "# #   s  #    #",
      "# #   #  #  c #",
      "# c   #  #  ###",
      "# ##### ##    #",
      "#     #  ###  #",
      "# #s# #    c  #",
      "# #   #####   #",
      "#SX############"
    ]
  },

  {
    name: "Access Control",
    hint: "An access card is used up the moment it opens a port. Look before you spend one.",
    time: 160,
    map: [
      "#################",
      "#P  #  y  #  c  #",
      "# b B     Y     #",
      "#   #  c  #  r  #",
      "#####  s  ### ###",
      "#     #####     #",
      "#  c  #   R  s  #",
      "#     #   #     #",
      "#  s  #   #  c  #",
      "#######   #######",
      "#      +      SX#",
      "#################"
    ]
  },

  {
    name: "Coolant Spill",
    hint: "Shove a crate into coolant and it plugs the leak. The Coolant Seal lets you wade in yourself.",
    time: 200,
    _bridge: [[2, 4]],
    map: [
      "#################",
      "#P   #   c   #s #",
      "# OO #~~~~~~~#  #",
      "#  c #~~~~~~~#  #",
      "##~~##~~~~~~~## #",
      "#     ~~~~~~~  c#",
      "#  F  ~~~~~~~   #",
      "##   #~~~~~~~## #",
      "# O  #~~~~~~~#  #",
      "#  s #~~~~~~~#s #",
      "#  + #~~~~~~~#  #",
      "#    #########  #",
      "#    #  X    S  #",
      "#################"
    ]
  },

  {
    name: "Thermal Runaway",
    hint: "The Heatsink makes overheat zones harmless. Surge traps are one-shot — never step on one.",
    time: 200,
    map: [
      "#################",
      "#P  #  c  #  s  #",
      "#   #     #     #",
      "# H #  s  #  c  #",
      "#   #     #     #",
      "##  ##***##  ####",
      "#    *****      #",
      "# c  *****  s   #",
      "#    *****      #",
      "##  ##***##  ####",
      "# + #  c  #     #",
      "# s #     #  c  #",
      "#   #  !  #  s  #",
      "#  SX######     #",
      "#################"
    ]
  },

  {
    name: "Cryo Vault",
    hint: "On cryo ice you keep going until something stops you. Grip Pads let you walk it like floor.",
    time: 220,
    map: [
      "###################",
      "#P    #     c     #",
      "#     #  1.....2  #",
      "#  c  #  .......  #",
      "#     #  .......  #",
      "##  ###  .......  #",
      "#   s    .......  #",
      "#        .......  #",
      "#  K ##  4.....3  #",
      "#     #     s     #",
      "#  c  #############",
      "#        s     c  #",
      "#   ##            #",
      "#  SX##  +        #",
      "###################"
    ]
  },

  {
    name: "Data Bus",
    hint: "A data bus carries you one tile per beat and will not let go. Mag Grips ignore it.",
    time: 220,
    map: [
      "#################",
      "#P  #  c  #  s  #",
      "#   #           #",
      "# c v  s  ^  c  #",
      "#   v     ^     #",
      "##  v     ^    ##",
      "#   >>>>>>>>>>  #",
      "#   <<<<<<<<<<  #",
      "#  M            #",
      "##  #### ####  ##",
      "#   #   c   #   #",
      "# s #   +   #  c#",
      "#   #   s   #   #",
      "#  SX############",
      "#################"
    ]
  },

  {
    name: "Malware Outbreak",
    hint: "Bugs hug the left wall, glitches hug the right wall, packets fly straight and bounce.",
    time: 200,
    map: [
      "#################",
      "#P   #  c  #  s #",
      "#    #  @  #    #",
      "# c  #     #  c #",
      "###  ##   ##   ##",
      "#     $         #",
      "#  s     %   s  #",
      "#          $    #",
      "##   ###  ###  ##",
      "#  c #  +  #  c #",
      "#    #     #    #",
      "#  s##  s  #    #",
      "#  SX#######    #",
      "#################"
    ]
  },

  {
    name: "Firewall",
    hint: "Root access is green: it opens every green port and is never used up. The rest are one-shot.",
    time: 240,
    map: [
      "###################",
      "#P  #  c  #  s    #",
      "#   #     #       #",
      "# g #  s  #  c    #",
      "#   #     ### #####",
      "##G##  b  #       #",
      "#      c  B       #",
      "#  &   #  #  s    #",
      "#      #  ###### ##",
      "##G##  s  #  c    #",
      "#   #     Y       #",
      "# y #  c  #  s    #",
      "#   #     #  +    #",
      "#  SX##############",
      "###################"
    ]
  },

  {
    name: "Network Ports",
    hint: "A network port throws you out of the next one in line. The toggle switch flips every toggle wall.",
    time: 260,
    map: [
      "###################",
      "#P  #   c   #  0  #",
      "#   #       #     #",
      "# 0 #   s   |  c  #",
      "#   #########-#####",
      "#   #   k   #  s  #",
      "##|##   c   #     #",
      "#  c    +   #  c  #",
      "##-##       #     #",
      "#   #   0   #-#####",
      "#   #########  s  #",
      "# s #       |     #",
      "#   #   s   #  0  #",
      "#  SX##############",
      "###################"
    ]
  },

  {
    name: "Final Assembly",
    hint: "Everything at once: bridge the coolant, ride the ice, cross the heat, mind the clock.",
    time: 340,
    _bridge: [[8, 3]],
    map: [
      "###################",
      "#P    #  c  #  s  #",
      "#     # ~~~~# y   #",
      "# O     ~F~~B  c  #",
      "# O   # ~~~~# %   #",
      "#  c  #  b  #     #",
      "### ##### ##### ###",
      "# s   #0 &  #H    #",
      "# ... #     ~     #",
      "#c...    +  ##***##",
      "# ... #  s  ## c ##",
      "#   K #     ## s ##",
      "### #####Y#########",
      "# c   #  c  #  c  #",
      "#     # $   # T   #",
      "#####             #",
      "#XS   #  s  #  s  #",
      "###   #     #   0 #",
      "###################"
    ]
  }
];

if (typeof module !== "undefined") { module.exports = { LEVELS }; }
