import io
p = 'src/simulation/agent.js'
s = io.open(p, encoding='utf-8').read()
start = s.index('  // Perceive nearby entities')
endm = '    return perception;' + chr(10) + '  }' + chr(10)
end = s.index(endm, start) + len(endm)
new = io.open('/tmp/newperceive.txt', encoding='utf-8').read()
s = s[:start] + new + s[end:]
io.open(p, 'w', encoding='utf-8').write(s)
print('OK')
