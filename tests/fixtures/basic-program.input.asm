CLEAR=147
!to "tiny.o",cbm
*=$c000
ldx    #0
lda .string,x ; get character
.string   !pet  "Dumb example",13,0

