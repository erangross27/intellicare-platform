import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

const ARROW_FONT_DATA = 'data:font/otf;base64,T1RUTwALAIAAAwAwQ0ZGINT+TNkAACtUAAANwUZGVE1UJva2AAA5OAAAABxHREVGAFMABAAAORgAAAAgT1MvMlwjMMEAAAEgAAAAYGNtYXA3hm/DAAApQAAAAfJoZWFk+ukMHAAAALwAAAA2aGhlYQk8A3EAAAD0AAAAJGhtdHhE+QbDAAA5VAAAAIRtYXhwACZQAAAAARgAAAAGbmFtZYVNsSMAAAGAAAAnwHBvc3T/iAAUAAArNAAAACAAAQAAAAEZmULV9L1fDzz1AAsD6AAAAADLV1eKAAAAAMtXV4oAAP7bBRoDrwABAAgAAgAAAAAAAAABAAAEH/45AAAFRwAA/9QFGgABAAAAAAAAAAAAAAAAAAAAHAAAUAAAJgAAAAIClwK8AAUAAAH0AfQAAAD6AfQB9AAAAfQAFAHNAAAAAAAAAAAAAAAAgAAACwAAAGgAAAAAAAAAAFNUSVgAIAAgInEC7v8GAf4EHwHHoAAAAZD+AAAAAAAAACAAIAABAAAAHAFWAAEAAAAAAAABigMWAAEAAAAAAAEADAS7AAEAAAAAAAIABATSAAEAAAAAAAMAIgUdAAEAAAAAAAQAEQVkAAEAAAAAAAUADQWSAAEAAAAAAAYAEQXEAAEAAAAAAAcAXAaQAAEAAAAAAAkAYgezAAEAAAAAAAoE1RHCAAEAAAAAAAsAGBbKAAEAAAAAAAwAHRcfAAEAAAAAAA0E4yEFAAEAAAAAAA4AKiY/AAMAAQQJAAADFAAAAAMAAQQJAAEAGAShAAMAAQQJAAIACATIAAMAAQQJAAMARATXAAMAAQQJAAQAIgVAAAMAAQQJAAUAGgV2AAMAAQQJAAYAIgWgAAMAAQQJAAcAuAXWAAMAAQQJAAkAxAbtAAMAAQQJAAoJqggWAAMAAQQJAAsAMBaYAAMAAQQJAAwAOhbjAAMAAQQJAA0Jxhc9AAMAAQQJAA4AVCXpAEMAbwBwAHkAcgBpAGcAaAB0ACAAKABjACkAIAAyADAAMAAxAC0AMgAwADEAMQAgAGIAeQAgAHQAaABlACAAUwBUAEkAIABQAHUAYgAgAEMAbwBtAHAAYQBuAGkAZQBzACwAIABjAG8AbgBzAGkAcwB0AGkAbgBnACAAbwBmACAAdABoAGUAIABBAG0AZQByAGkAYwBhAG4AIABDAGgAZQBtAGkAYwBhAGwAIABTAG8AYwBpAGUAdAB5ACwAIAB0AGgAZQAgAEEAbQBlAHIAaQBjAGEAbgAgAEkAbgBzAHQAaQB0AHUAdABlACAAbwBmACAAUABoAHkAcwBpAGMAcwAsACAAdABoAGUAIABBAG0AZQByAGkAYwBhAG4AIABNAGEAdABoAGUAbQBhAHQAaQBjAGEAbAAgAFMAbwBjAGkAZQB0AHkALAAgAHQAaABlACAAQQBtAGUAcgBpAGMAYQBuACAAUABoAHkAcwBpAGMAYQBsACAAUwBvAGMAaQBlAHQAeQAsACAARQBsAHMAZQB2AGkAZQByACwAIABJAG4AYwAuACwAIABhAG4AZAAgAFQAaABlACAASQBuAHMAdABpAHQAdQB0AGUAIABvAGYAIABFAGwAZQBjAHQAcgBpAGMAYQBsACAAYQBuAGQAIABFAGwAZQBjAHQAcgBvAG4AaQBjACAARQBuAGcAaQBuAGUAZQByAHMALAAgAEkAbgBjAC4AIABQAG8AcgB0AGkAbwBuAHMAIABjAG8AcAB5AHIAaQBnAGgAdAAgACgAYwApACAAMQA5ADkAOAAtADIAMAAwADMAIABiAHkAIABNAGkAYwByAG8AUAByAGUAcwBzACwAIABJAG4AYwAuACAAUABvAHIAdABpAG8AbgBzACAAYwBvAHAAeQByAGkAZwBoAHQAIAAoAGMAKQAgADEAOQA5ADAAIABiAHkAIABFAGwAcwBlAHYAaQBlAHIALAAgAEkAbgBjAC4AIABBAGwAbAAgAHIAaQBnAGgAdABzACAAcgBlAHMAZQByAHYAZQBkAC4AAENvcHlyaWdodCAoYykgMjAwMS0yMDExIGJ5IHRoZSBTVEkgUHViIENvbXBhbmllcywgY29uc2lzdGluZyBvZiB0aGUgQW1lcmljYW4gQ2hlbWljYWwgU29jaWV0eSwgdGhlIEFtZXJpY2FuIEluc3RpdHV0ZSBvZiBQaHlzaWNzLCB0aGUgQW1lcmljYW4gTWF0aGVtYXRpY2FsIFNvY2lldHksIHRoZSBBbWVyaWNhbiBQaHlzaWNhbCBTb2NpZXR5LCBFbHNldmllciwgSW5jLiwgYW5kIFRoZSBJbnN0aXR1dGUgb2YgRWxlY3RyaWNhbCBhbmQgRWxlY3Ryb25pYyBFbmdpbmVlcnMsIEluYy4gUG9ydGlvbnMgY29weXJpZ2h0IChjKSAxOTk4LTIwMDMgYnkgTWljcm9QcmVzcywgSW5jLiBQb3J0aW9ucyBjb3B5cmlnaHQgKGMpIDE5OTAgYnkgRWxzZXZpZXIsIEluYy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4AAFMAVABJAFgAVgBhAHIAaQBhAG4AdABzAABTVElYVmFyaWFudHMAAEIAbwBsAGQAAEJvbGQAAEYAbwBuAHQATQBhAHMAdABlAHIAOgBTAFQASQBYAFYAYQByAGkAYQBuAHQAcwAtAEIAbwBsAGQAOgAxAC4AMQAuADAAAEZvbnRNYXN0ZXI6U1RJWFZhcmlhbnRzLUJvbGQ6MS4xLjAAAFMAVABJAFgAVgBhAHIAaQBhAG4AdABzAC0AQgBvAGwAZAAAU1RJWFZhcmlhbnRzLUJvbGQAAFYAZQByAHMAaQBvAG4AIAAxAC4AMQAuADAAAFZlcnNpb24gMS4xLjAAAFMAVABJAFgAVgBhAHIAaQBhAG4AdABzAC0AQgBvAGwAZAAAU1RJWFZhcmlhbnRzLUJvbGQAAFMAVABJAFgAIABGAG8AbgB0AHMAKABUAE0AKQAgAGkAcwAgAGEAIAB0AHIAYQBkAGUAbQBhAHIAawAgAG8AZgAgAFQAaABlACAASQBuAHMAdABpAHQAdQB0AGUAIABvAGYAIABFAGwAZQBjAHQAcgBpAGMAYQBsACAAYQBuAGQAIABFAGwAZQBjAHQAcgBvAG4AaQBjAHMAIABFAG4AZwBpAG4AZQBlAHIAcwAsACAASQBuAGMALgAAU1RJWCBGb250cyhUTSkgaXMgYSB0cmFkZW1hcmsgb2YgVGhlIEluc3RpdHV0ZSBvZiBFbGVjdHJpY2FsIGFuZCBFbGVjdHJvbmljcyBFbmdpbmVlcnMsIEluYy4AAE0AaQBjAHIAbwBQAHIAZQBzAHMAIABJAG4AYwAuACwAIAB3AGkAdABoACAAZgBpAG4AYQBsACAAYQBkAGQAaQB0AGkAbwBuAHMAIABhAG4AZAAgAGMAbwByAHIAZQBjAHQAaQBvAG4AcwAgAHAAcgBvAHYAaQBkAGUAZAAgAGIAeQAgAEMAbwBlAG4AIABIAG8AZgBmAG0AYQBuACwAIABFAGwAcwBlAHYAaQBlAHIAIAAoAHIAZQB0AGkAcgBlAGQAKQAATWljcm9QcmVzcyBJbmMuLCB3aXRoIGZpbmFsIGFkZGl0aW9ucyBhbmQgY29ycmVjdGlvbnMgcHJvdmlkZWQgYnkgQ29lbiBIb2ZmbWFuLCBFbHNldmllciAocmV0aXJlZCkAAEEAcgBpAGUAIABkAGUAIABSAHUAaQB0AGUAcgAsACAAdwBoAG8AIABpAG4AIAAxADkAOQA1ACAAdwBhAHMAIABIAGUAYQBkACAAbwBmACAASQBuAGYAbwByAG0AYQB0AGkAbwBuACAAVABlAGMAaABuAG8AbABvAGcAeQAgAEQAZQB2AGUAbABvAHAAbQBlAG4AdAAgAGEAdAAgAEUAbABzAGUAdgBpAGUAcgAgAFMAYwBpAGUAbgBjAGUALAAgAG0AYQBkAGUAIABhACAAcAByAG8AcABvAHMAYQBsACAAdABvACAAdABoAGUAIABTAFQASQAgAFAAdQBiACAAZwByAG8AdQBwACwAIABhAG4AIABpAG4AZgBvAHIAbQBhAGwAIABnAHIAbwB1AHAAIABvAGYAIABwAHUAYgBsAGkAcwBoAGUAcgBzACAAYwBvAG4AcwBpAHMAdABpAG4AZwAgAG8AZgAgAHIAZQBwAHIAZQBzAGUAbgB0AGEAdABpAHYAZQBzACAAZgByAG8AbQAgAHQAaABlACAAQQBtAGUAcgBpAGMAYQBuACAAQwBoAGUAbQBpAGMAYQBsACAAUwBvAGMAaQBlAHQAeQAgACgAQQBDAFMAKQAsACAAQQBtAGUAcgBpAGMAYQBuACAASQBuAHMAdABpAHQAdQB0AGUAIABvAGYAIABQAGgAeQBzAGkAYwBzACAAKABBAEkAUAApACwAIABBAG0AZQByAGkAYwBhAG4AIABNAGEAdABoAGUAbQBhAHQAaQBjAGEAbAAgAFMAbwBjAGkAZQB0AHkAIAAoAEEATQBTACkALAAgAEEAbQBlAHIAaQBjAGEAbgAgAFAAaAB5AHMAaQBjAGEAbAAgAFMAbwBjAGkAZQB0AHkAIAAoAEEAUABTACkALAAgAEUAbABzAGUAdgBpAGUAcgAsACAAYQBuAGQAIABJAG4AcwB0AGkAdAB1AHQAZQAgAG8AZgAgAEUAbABlAGMAdAByAGkAYwBhAGwAIABhAG4AZAAgAEUAbABlAGMAdAByAG8AbgBpAGMAcwAgAEUAbgBnAGkAbgBlAGUAcgBzACAAKABJAEUARQBFACkALgAgAEQAZQAgAFIAdQBpAHQAZQByACAAZQBuAGMAbwB1AHIAYQBnAGUAZAAgAHQAaABlACAAbQBlAG0AYgBlAHIAcwAgAHQAbwAgAGMAbwBuAHMAaQBkAGUAcgAgAGQAZQB2AGUAbABvAHAAbQBlAG4AdAAgAG8AZgAgAGEAIABzAGUAcgBpAGUAcwAgAG8AZgAgAFcAZQBiACAAZgBvAG4AdABzACwAIAB3AGgAaQBjAGgAIABoAGUAIABwAHIAbwBwAG8AcwBlAGQAIABzAGgAbwB1AGwAZAAgAGIAZQAgAGMAYQBsAGwAZQBkACAAdABoAGUAIABTAGMAaQBlAG4AdABpAGYAaQBjACAAYQBuAGQAIABUAGUAYwBoAG4AaQBjAGEAbAAgAEkAbgBmAG8AcgBtAGEAdABpAG8AbgAgAGUAWABjAGgAYQBuAGcAZQAsACAAbwByACAAUwBUAEkAWAAsACAARgBvAG4AdABzAC4AIABBAGwAbAAgAFMAVABJACAAUAB1AGIAIABtAGUAbQBiAGUAcgAgAG8AcgBnAGEAbgBpAHoAYQB0AGkAbwBuAHMAIABlAG4AdABoAHUAcwBpAGEAcwB0AGkAYwBhAGwAbAB5ACAAZQBuAGQAbwByAHMAZQBkACAAdABoAGkAcwAgAHAAcgBvAHAAbwBzAGEAbAAsACAAYQBuAGQAIAB0AGgAZQAgAFMAVABJACAAUAB1AGIAIABnAHIAbwB1AHAAIABhAGcAcgBlAGUAZAAgAHQAbwAgAGUAbQBiAGEAcgBrACAAbwBuACAAdwBoAGEAdAAgAGgAYQBzACAAYgBlAGMAbwBtAGUAIABhACAAdAB3AGUAbAB2AGUALQB5AGUAYQByACAAcAByAG8AagBlAGMAdAAuACAAVABoAGUAIABnAG8AYQBsACAAbwBmACAAdABoAGUAIABwAHIAbwBqAGUAYwB0ACAAdwBhAHMAIAB0AG8AIABpAGQAZQBuAHQAaQBmAHkAIABhAGwAbAAgAGEAbABwAGgAYQBiAGUAdABpAGMALAAgAHMAeQBtAGIAbwBsAGkAYwAsACAAYQBuAGQAIABvAHQAaABlAHIAIABzAHAAZQBjAGkAYQBsACAAYwBoAGEAcgBhAGMAdABlAHIAcwAgAHUAcwBlAGQAIABpAG4AIABhAG4AeQAgAGYAYQBjAGUAdAAgAG8AZgAgAHMAYwBpAGUAbgB0AGkAZgBpAGMAIABwAHUAYgBsAGkAcwBoAGkAbgBnACAAYQBuAGQAIAB0AG8AIABjAHIAZQBhAHQAZQAgAGEAIABzAGUAdAAgAG8AZgAgAFUAbgBpAGMAbwBkAGUALQBiAGEAcwBlAGQAIABmAG8AbgB0AHMAIAB0AGgAYQB0ACAAdwBvAHUAbABkACAAYgBlACAAZABpAHMAdAByAGkAYgB1AHQAZQBkACAAZgByAGUAZQAgAHQAbwAgAGUAdgBlAHIAeQAgAHMAYwBpAGUAbgB0AGkAcwB0ACwAIABzAHQAdQBkAGUAbgB0ACwAIABhAG4AZAAgAG8AdABoAGUAcgAgAGkAbgB0AGUAcgBlAHMAdABlAGQAIABwAGEAcgB0AHkAIAB3AG8AcgBsAGQAdwBpAGQAZQAuACAAVABoAGUAIABmAG8AbgB0AHMAIAB3AG8AdQBsAGQAIABiAGUAIABjAG8AbgBzAGkAcwB0AGUAbgB0ACAAdwBpAHQAaAAgAHQAaABlACAAZQBtAGUAcgBnAGkAbgBnACAAVQBuAGkAYwBvAGQAZQAgAHMAdABhAG4AZABhAHIAZAAsACAAYQBuAGQAIAB3AG8AdQBsAGQAIABwAGUAcgBtAGkAdAAgAHUAbgBpAHYAZQByAHMAYQBsACAAcgBlAHAAcgBlAHMAZQBuAHQAYQB0AGkAbwBuACAAbwBmACAAZQB2AGUAcgB5ACAAYwBoAGEAcgBhAGMAdABlAHIALgAgAFcAaQB0AGgAIAB0AGgAZQAgAHIAZQBsAGUAYQBzAGUAIABvAGYAIAB0AGgAZQAgAFMAVABJAFgAIABmAG8AbgB0AHMALAAgAGQAZQAgAFIAdQBpAHQAZQByACcAcwAgAHYAaQBzAGkAbwBuACAAaABhAHMAIABiAGUAZQBuACAAcgBlAGEAbABpAHoAZQBkAC4AAEFyaWUgZGUgUnVpdGVyLCB3aG8gaW4gMTk5NSB3YXMgSGVhZCBvZiBJbmZvcm1hdGlvbiBUZWNobm9sb2d5IERldmVsb3BtZW50IGF0IEVsc2V2aWVyIFNjaWVuY2UsIG1hZGUgYSBwcm9wb3NhbCB0byB0aGUgU1RJIFB1YiBncm91cCwgYW4gaW5mb3JtYWwgZ3JvdXAgb2YgcHVibGlzaGVycyBjb25zaXN0aW5nIG9mIHJlcHJlc2VudGF0aXZlcyBmcm9tIHRoZSBBbWVyaWNhbiBDaGVtaWNhbCBTb2NpZXR5IChBQ1MpLCBBbWVyaWNhbiBJbnN0aXR1dGUgb2YgUGh5c2ljcyAoQUlQKSwgQW1lcmljYW4gTWF0aGVtYXRpY2FsIFNvY2lldHkgKEFNUyksIEFtZXJpY2FuIFBoeXNpY2FsIFNvY2lldHkgKEFQUyksIEVsc2V2aWVyLCBhbmQgSW5zdGl0dXRlIG9mIEVsZWN0cmljYWwgYW5kIEVsZWN0cm9uaWNzIEVuZ2luZWVycyAoSUVFRSkuIERlIFJ1aXRlciBlbmNvdXJhZ2VkIHRoZSBtZW1iZXJzIHRvIGNvbnNpZGVyIGRldmVsb3BtZW50IG9mIGEgc2VyaWVzIG9mIFdlYiBmb250cywgd2hpY2ggaGUgcHJvcG9zZWQgc2hvdWxkIGJlIGNhbGxlZCB0aGUgU2NpZW50aWZpYyBhbmQgVGVjaG5pY2FsIEluZm9ybWF0aW9uIGVYY2hhbmdlLCBvciBTVElYLCBGb250cy4gQWxsIFNUSSBQdWIgbWVtYmVyIG9yZ2FuaXphdGlvbnMgZW50aHVzaWFzdGljYWxseSBlbmRvcnNlZCB0aGlzIHByb3Bvc2FsLCBhbmQgdGhlIFNUSSBQdWIgZ3JvdXAgYWdyZWVkIHRvIGVtYmFyayBvbiB3aGF0IGhhcyBiZWNvbWUgYSB0d2VsdmUteWVhciBwcm9qZWN0LiBUaGUgZ29hbCBvZiB0aGUgcHJvamVjdCB3YXMgdG8gaWRlbnRpZnkgYWxsIGFscGhhYmV0aWMsIHN5bWJvbGljLCBhbmQgb3RoZXIgc3BlY2lhbCBjaGFyYWN0ZXJzIHVzZWQgaW4gYW55IGZhY2V0IG9mIHNjaWVudGlmaWMgcHVibGlzaGluZyBhbmQgdG8gY3JlYXRlIGEgc2V0IG9mIFVuaWNvZGUtYmFzZWQgZm9udHMgdGhhdCB3b3VsZCBiZSBkaXN0cmlidXRlZCBmcmVlIHRvIGV2ZXJ5IHNjaWVudGlzdCwgc3R1ZGVudCwgYW5kIG90aGVyIGludGVyZXN0ZWQgcGFydHkgd29ybGR3aWRlLiBUaGUgZm9udHMgd291bGQgYmUgY29uc2lzdGVudCB3aXRoIHRoZSBlbWVyZ2luZyBVbmljb2RlIHN0YW5kYXJkLCBhbmQgd291bGQgcGVybWl0IHVuaXZlcnNhbCByZXByZXNlbnRhdGlvbiBvZiBldmVyeSBjaGFyYWN0ZXIuIFdpdGggdGhlIHJlbGVhc2Ugb2YgdGhlIFNUSVggZm9udHMsIGRlIFJ1aXRlcidzIHZpc2lvbiBoYXMgYmVlbiByZWFsaXplZC4AAGgAdAB0AHAAOgAvAC8AdwB3AHcALgBzAHQAaQB4AGYAbwBuAHQAcwAuAG8AcgBnAABodHRwOi8vd3d3LnN0aXhmb250cy5vcmcAAGgAdAB0AHAAOgAvAC8AdwB3AHcALgBtAGkAYwByAG8AcAByAGUAcwBzAC0AaQBuAGMALgBjAG8AbQAAaHR0cDovL3d3dy5taWNyb3ByZXNzLWluYy5jb20AAEEAcwAgAGEAIABjAG8AbgBkAGkAdABpAG8AbgAgAGYAbwByACAAcgBlAGMAZQBpAHYAaQBuAGcAIAB0AGgAZQBzAGUAIABmAG8AbgB0AHMAIABhAHQAIABuAG8AIABjAGgAYQByAGcAZQAsACAAZQBhAGMAaAAgAHAAZQByAHMAbwBuACAAZABvAHcAbgBsAG8AYQBkAGkAbgBnACAAdABoAGUAIABmAG8AbgB0AHMAIABtAHUAcwB0ACAAYQBnAHIAZQBlACAAdABvACAAcwBvAG0AZQAgAHMAaQBtAHAAbABlACAAbABpAGMAZQBuAHMAZQAgAHQAZQByAG0AcwAuACAAVABoAGUAIABsAGkAYwBlAG4AcwBlACAAaQBzACAAYgBhAHMAZQBkACAAbwBuACAAdABoAGUAIABTAEkATAAgAE8AcABlAG4AIABGAG8AbgB0ACAATABpAGMAZQBuAHMAZQAgADwAaAB0AHQAcAA6AC8ALwBzAGMAcgBpAHAAdABzAC4AcwBpAGwALgBvAHIAZwAvAGMAbQBzAC8AcwBjAHIAaQBwAHQAcwAvAHAAYQBnAGUALgBwAGgAcAA/AHMAaQB0AGUAXwBpAGQAPQBuAHIAcwBpACYAaQBkAD0ATwBGAEwAPgAuACAAVABoAGUAIABTAEkATAAgAEwAaQBjAGUAbgBzAGUAIABpAHMAIABhACAAZgByAGUAZQAgAGEAbgBkACAAbwBwAGUAbgAgAHMAbwB1AHIAYwBlACAAbABpAGMAZQBuAHMAZQAgAHMAcABlAGMAaQBmAGkAYwBhAGwAbAB5ACAAZABlAHMAaQBnAG4AZQBkACAAZgBvAHIAIABmAG8AbgB0AHMAIABhAG4AZAAgAHIAZQBsAGEAdABlAGQAIABzAG8AZgB0AHcAYQByAGUALgAgAFQAaABlACAAYgBhAHMAaQBjACAAdABlAHIAbQBzACAAYQByAGUAIAB0AGgAYQB0ACAAdABoAGUAIAByAGUAYwBpAHAAaQBlAG4AdAAgAHcAaQBsAGwAIABuAG8AdAAgAHIAZQBtAG8AdgBlACAAdABoAGUAIABjAG8AcAB5AHIAaQBnAGgAdAAgAGEAbgBkACAAdAByAGEAZABlAG0AYQByAGsAIABzAHQAYQB0AGUAbQBlAG4AdABzACAAZgByAG8AbQAgAHQAaABlACAAZgBvAG4AdABzACAAYQBuAGQAIAB0AGgAYQB0ACwAIABpAGYAIAB0AGgAZQAgAHAAZQByAHMAbwBuACAAZABlAGMAaQBkAGUAcwAgAHQAbwAgAGMAcgBlAGEAdABlACAAYQAgAGQAZQByAGkAdgBhAHQAaQB2AGUAIAB3AG8AcgBrACAAYgBhAHMAZQBkACAAbwBuACAAdABoAGUAIABTAFQASQBYACAARgBvAG4AdABzACAAYgB1AHQAIABpAG4AYwBvAHIAcABvAHIAYQB0AGkAbgBnACAAcwBvAG0AZQAgAGMAaABhAG4AZwBlAHMAIABvAHIAIABlAG4AaABhAG4AYwBlAG0AZQBuAHQAcwAsACAAdABoAGUAIABkAGUAcgBpAHYAYQB0AGkAdgBlACAAdwBvAHIAawAgACgAIgBNAG8AZABpAGYAaQBlAGQAIABWAGUAcgBzAGkAbwBuACIAKQAgAHcAaQBsAGwAIABjAGEAcgByAHkAIABhACAAZABpAGYAZgBlAHIAZQBuAHQAIABuAGEAbQBlAC4AIABUAGgAZQAgAGMAbwBwAHkAcgBpAGcAaAB0ACAAYQBuAGQAIAB0AHIAYQBkAGUAbQBhAHIAawAgAHIAZQBzAHQAcgBpAGMAdABpAG8AbgBzACAAYQByAGUAIABwAGEAcgB0ACAAbwBmACAAdABoAGUAIABhAGcAcgBlAGUAbQBlAG4AdAAgAGIAZQB0AHcAZQBlAG4AIAB0AGgAZQAgAFMAVABJACAAUAB1AGIAIABjAG8AbQBwAGEAbgBpAGUAcwAgAGEAbgBkACAAdABoAGUAIAB0AHkAcABlAGYAYQBjAGUAIABkAGUAcwBpAGcAbgBlAHIALgAgAFQAaABlACAAIgByAGUAbgBhAG0AaQBuAGcAIgAgAHIAZQBzAHQAcgBpAGMAdABpAG8AbgAgAHIAZQBzAHUAbAB0AHMAIABmAHIAbwBtACAAdABoAGUAIABkAGUAcwBpAHIAZQAgAG8AZgAgAHQAaABlACAAUwBUAEkAIABQAHUAYgAgAGMAbwBtAHAAYQBuAGkAZQBzACAAdABvACAAYQBzAHMAdQByAGUAIAB0AGgAYQB0ACAAdABoAGUAIABTAFQASQBYACAARgBvAG4AdABzACAAdwBpAGwAbAAgAGMAbwBuAHQAaQBuAHUAZQAgAHQAbwAgAGYAdQBuAGMAdABpAG8AbgAgAGkAbgAgAGEAIABwAHIAZQBkAGkAYwB0AGEAYgBsAGUAIABmAGEAcwBoAGkAbwBuACAAZgBvAHIAIABhAGwAbAAgAHQAaABhAHQAIAB1AHMAZQAgAHQAaABlAG0ALgAgAE4AbwAgAGMAbwBwAHkAIABvAGYAIABvAG4AZQAgAG8AcgAgAG0AbwByAGUAIABvAGYAIAB0AGgAZQAgAGkAbgBkAGkAdgBpAGQAdQBhAGwAIABGAG8AbgB0ACAAdAB5AHAAZQBmAGEAYwBlAHMAIAB0AGgAYQB0ACAAZgBvAHIAbQAgAHQAaABlACAAUwBUAEkAWAAgAEYAbwBuAHQAcwAoAFQATQApACAAcwBlAHQAIABtAGEAeQAgAGIAZQAgAHMAbwBsAGQAIABiAHkAIABpAHQAcwBlAGwAZgAsACAAYgB1AHQAIABvAHQAaABlAHIAIAB0AGgAYQBuACAAdABoAGkAcwAgAG8AbgBlACAAcgBlAHMAdAByAGkAYwB0AGkAbwBuACwAIABsAGkAYwBlAG4AcwBlAGUAcwAgAGEAcgBlACAAZgByAGUAZQAgAHQAbwAgAHMAZQBsAGwAIAB0AGgAZQAgAGYAbwBuAHQAcwAgAGUAaQB0AGgAZQByACAAcwBlAHAAYQByAGEAdABlAGwAeQAgAG8AcgAgAGEAcwAgAHAAYQByAHQAIABvAGYAIABhACAAcABhAGMAawBhAGcAZQAgAHQAaABhAHQAIABjAG8AbQBiAGkAbgBlAHMAIABvAHQAaABlAHIAIABzAG8AZgB0AHcAYQByAGUAIABvAHIAIABmAG8AbgB0AHMAIAB3AGkAdABoACAAdABoAGkAcwAgAGYAbwBuAHQAIABzAGUAdAAuAABBcyBhIGNvbmRpdGlvbiBmb3IgcmVjZWl2aW5nIHRoZXNlIGZvbnRzIGF0IG5vIGNoYXJnZSwgZWFjaCBwZXJzb24gZG93bmxvYWRpbmcgdGhlIGZvbnRzIG11c3QgYWdyZWUgdG8gc29tZSBzaW1wbGUgbGljZW5zZSB0ZXJtcy4gVGhlIGxpY2Vuc2UgaXMgYmFzZWQgb24gdGhlIFNJTCBPcGVuIEZvbnQgTGljZW5zZSA8aHR0cDovL3NjcmlwdHMuc2lsLm9yZy9jbXMvc2NyaXB0cy9wYWdlLnBocD9zaXRlX2lkPW5yc2kmaWQ9T0ZMPi4gVGhlIFNJTCBMaWNlbnNlIGlzIGEgZnJlZSBhbmQgb3BlbiBzb3VyY2UgbGljZW5zZSBzcGVjaWZpY2FsbHkgZGVzaWduZWQgZm9yIGZvbnRzIGFuZCByZWxhdGVkIHNvZnR3YXJlLiBUaGUgYmFzaWMgdGVybXMgYXJlIHRoYXQgdGhlIHJlY2lwaWVudCB3aWxsIG5vdCByZW1vdmUgdGhlIGNvcHlyaWdodCBhbmQgdHJhZGVtYXJrIHN0YXRlbWVudHMgZnJvbSB0aGUgZm9udHMgYW5kIHRoYXQsIGlmIHRoZSBwZXJzb24gZGVjaWRlcyB0byBjcmVhdGUgYSBkZXJpdmF0aXZlIHdvcmsgYmFzZWQgb24gdGhlIFNUSVggRm9udHMgYnV0IGluY29ycG9yYXRpbmcgc29tZSBjaGFuZ2VzIG9yIGVuaGFuY2VtZW50cywgdGhlIGRlcml2YXRpdmUgd29yayAoIk1vZGlmaWVkIFZlcnNpb24iKSB3aWxsIGNhcnJ5IGEgZGlmZmVyZW50IG5hbWUuIFRoZSBjb3B5cmlnaHQgYW5kIHRyYWRlbWFyayByZXN0cmljdGlvbnMgYXJlIHBhcnQgb2YgdGhlIGFn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';
Font.register({ family: 'STIXArrow', src: ARROW_FONT_DATA });

/**
 * Arthritis Assessments Document PDF Template
 * PDFDownloadLink + pdfData memo pattern
 * ASCII separators only (no unicode box-drawing)
 * Canonical box-free typography with JSX/Copy row parity
 */

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 14,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
    color: '#000000',
  },
  documentTitle: {
    fontSize: 26,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 24,
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    paddingBottom: 6,
    color: '#000000',
  },
  recordSection: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
  },
  recordTitle: {
    fontSize: 19,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 16,
    color: '#000000',
  },
  fieldContainer: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    marginBottom: 6,
    color: '#000000',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    paddingBottom: 4,
  },
  fieldContent: {
    fontSize: 14,
    lineHeight: 1.5,
    paddingLeft: 12,
    color: '#000000',
  },
  arrowGlyph: {
    fontFamily: 'STIXArrow',
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
    paddingLeft: 12,
    color: '#000000',
    borderBottomWidth: 0.5,
    borderBottomColor: '#999999',
    borderBottomStyle: 'solid',
    paddingBottom: 2,
  },
  listItem: {
    fontSize: 14,
    lineHeight: 1.5,
    paddingLeft: 12,
    marginBottom: 4,
    color: '#000000',
  },
  emptyState: {
    textAlign: 'center',
    padding: 40,
    fontSize: 14,
    color: '#666666',
  },
  separator: {
    fontSize: 10,
    color: '#999999',
    marginBottom: 8,
    textAlign: 'center',
  },
});

const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return dateString; }
};

const splitBySentence = (text) => {
  if (!text || typeof text !== 'string') return [];
  const protectedText = text.replace(/\b(Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc)\./gi, '$1<dot>');
  return protectedText.split(/[.;]\s+/).map(s => s.replace(/<dot>/g, '.').replace(/[;.]+$/, '').trim()).filter(Boolean);
};

/* splitByComma: parenthesis-aware comma split with thousands-digit guard (mirrors the JSX). */
const splitByComma = (text) => {
  if (!text || typeof text !== 'string') return [text || ''];
  const result = []; let current = ''; let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') { depth++; current += ch; }
    else if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; }
    else if (ch === ',' && depth === 0 && !(/\d/.test(text[i - 1] || '') && /\d/.test(text[i + 1] || ''))) { const t = current.trim(); if (t) result.push(t); current = ''; }
    else { current += ch; }
  }
  const t = current.trim(); if (t) result.push(t);
  return result.length > 0 ? result : [text];
};

/* parseLabel: detect "Label: value" (mirrors the JSX). */
const parseLabel = (text) => {
  if (!text || typeof text !== 'string') return { isLabeled: false, label: '', value: text || '' };
  const m = text.match(/^([A-Za-z][A-Za-z0-9\s/&(),.#'"-]{1,60}?):\s+([\s\S]*)/);
  if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() };
  return { isLabeled: false, label: '', value: text };
};

/* pdfSafe: ASCII-map symbols the built-in Helvetica lacks so they render legibly. */
const pdfSafe = (s) => String(s == null ? '' : s)
  .replace(/≥/g, '>=').replace(/≤/g, '<=')
  .replace(/µ/g, 'u').replace(/±/g, '+/-').replace(/×/g, 'x').replace(/°/g, ' deg');

const renderPdfSafe = (value) => pdfSafe(value).split(/(→)/g).map((part, index) => (
  part === '→' ? <Text key={`arrow-${index}`} style={styles.arrowGlyph}>{part}</Text> : part
));

const ArthritisAssessmentsDocumentPDFTemplate = ({ document: templateData }) => {
  const records = React.useMemo(() => {
    if (!templateData) return [];
    let arr = Array.isArray(templateData) ? templateData : [templateData];
    arr = arr.flatMap(r => {
      if (r?.arthritis_assessments) {
        const v = r.arthritis_assessments;
        return Array.isArray(v) ? v : [v];
      }
      if (r?.documentData) {
        const dd = r.documentData;
        if (Array.isArray(dd)) return dd;
        if (dd?.arthritis_assessments) {
          const v = dd.arthritis_assessments;
          return Array.isArray(v) ? v : [v];
        }
        return [dd];
      }
      if (r?.data) {
        const dd = r.data;
        if (Array.isArray(dd)) return dd;
        if (dd?.arthritis_assessments) {
          const v = dd.arthritis_assessments;
          return Array.isArray(v) ? v : [v];
        }
        return [dd];
      }
      return [r];
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [templateData]);

  // Rule #74 page-break: wrap={false} keeps a small block (title +
  // content) atomic so react-pdf moves it WHOLE to the next page → no orphaned title; for >8 rows
  // wrap={true} + glue [title + first row] in a wrap={false} sub-view so the list flows but the title
  // never orphans. Wrap values must always be explicit booleans.
  const renderField = (label, value) => {
    if (!value || (Array.isArray(value) && value.length === 0) || String(value).trim() === '') return null;
    // "Label: value" → fieldTitle (section) + sub-label + value (mirrors the JSX nested-subtitle; never side-by-side).
    const parsed = parseLabel(String(value));
    return (
      <View style={styles.fieldContainer} wrap={false}>
        <Text style={styles.sectionTitle}>{label}</Text>
        {parsed.isLabeled ? (
          <>
            <Text style={styles.fieldLabel}>{renderPdfSafe(parsed.label)}</Text>
            <Text style={styles.fieldContent}>{renderPdfSafe(parsed.value)}</Text>
          </>
        ) : (
          <Text style={styles.fieldContent}>{renderPdfSafe(value)}</Text>
        )}
      </View>
    );
  };

  const renderNumberedList = (label, items) => {
    const wrapItems = items.length > 8;
    return (
      <View style={styles.fieldContainer} wrap={wrapItems}>
        {wrapItems ? (
          <>
            <View wrap={false}>
              <Text style={styles.sectionTitle}>{label}</Text>
              <Text style={styles.listItem}>1. {renderPdfSafe(items[0])}</Text>
            </View>
            {items.slice(1).map((item, i) => (
              <Text key={i + 1} style={styles.listItem}>{i + 2}. {renderPdfSafe(item)}</Text>
            ))}
          </>
        ) : (
          <>
            <Text style={styles.sectionTitle}>{label}</Text>
            {items.map((item, i) => (
              <Text key={i} style={styles.listItem}>{i + 1}. {renderPdfSafe(item)}</Text>
            ))}
          </>
        )}
      </View>
    );
  };

  const renderArrayField = (label, items) => {
    if (!items || !Array.isArray(items) || items.length === 0) return null;
    return renderNumberedList(label, items);
  };

  const renderSentenceField = (label, value) => {
    if (!value || String(value).trim() === '') return null;
    const sentences = splitBySentence(String(value));
    if (sentences.length <= 1) return renderField(label, value);
    return renderNumberedList(label, sentences.map(sentence => { const parsed = parseLabel(sentence); return parsed.isLabeled ? parsed.value : sentence; }));
  };

  /* Comma-list field (followUp): one numbered row per comma item, paren-aware. Mirrors the JSX. */
  const renderCommaField = (label, value) => {
    if (!value || String(value).trim() === '') return null;
    const items = splitByComma(String(value));
    if (items.length <= 1) return renderField(label, value);
    return renderNumberedList(label, items.map(item => { const parsed = parseLabel(item); return parsed.isLabeled ? parsed.value : item; }));
  };

  if (!records || records.length === 0) {
    return (
      <Document>
        <Page size="A4" style={styles.page}>
          <Text style={styles.documentTitle}>Arthritis Assessments</Text>
          <Text style={styles.emptyState}>No arthritis assessment records available</Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.documentTitle}>Arthritis Assessments</Text>

        {records.map((record, idx) => (
          <View key={idx} style={styles.recordSection} break={idx > 0}>
            {/* Record Header */}
            <View wrap={false}>
              <Text style={styles.recordTitle}>
                {`Arthritis Assessment ${idx + 1}`}
              </Text>
            </View>

            {idx > 0 && <Text style={styles.separator}>{'='.repeat(60)}</Text>}

            {renderField('Assessment Date', record.date ? formatDate(record.date) : '')}
            {renderField('Arthritis Type', record.arthritisType)}
            {renderArrayField('Affected Joints', record.affectedJoints)}
            {renderField('Pain Level', record.painLevel)}
            {renderField('Stiffness', record.stiffness)}
            {renderSentenceField('Swelling', record.swelling)}
            {renderSentenceField('Functional Limitations', record.functionalLimitations)}
            {renderField('Disease Activity', record.diseaseActivity)}
            {renderCommaField('Inflammatory Markers', record.inflammatoryMarkers)}
            {renderSentenceField('Serology', record.serology)}
            {renderSentenceField('Imaging', record.imaging)}
            {renderArrayField('Current Medications', record.currentMedications)}
            {renderSentenceField('Medication Response', record.medicationResponse)}
            {renderSentenceField('Side Effects', record.sideEffects)}
            {renderSentenceField('Treatment Plan', record.treatmentPlan)}
            {renderSentenceField('Physical Therapy', record.physicalTherapy)}
            {renderCommaField('Follow Up', record.followUp)}
            {renderField('Rheumatologist', record.rheumatologist)}
            {renderField('Facility', record.facility)}
            {renderSentenceField('Notes', record.notes)}
          </View>
        ))}
      </Page>
    </Document>
  );
};

export default ArthritisAssessmentsDocumentPDFTemplate;
