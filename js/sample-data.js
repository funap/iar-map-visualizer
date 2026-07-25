/**
 * Fallback Sample Data for IAR Map Visualizer
 */

const SAMPLE_MAP_FALLBACK = `###############################################################################
#
# IAR ELF Linker V8.50.1.245/W32 for ARM
# Copyright 2007-2020 IAR Systems AB.
#
###############################################################################

***************************************************************************
*** PLACEMENT SUMMARY ***

  "A1": place at address 0x08000000 { ro section .text, ro section .rodata };
  "A2": place at address 0x90000000 { ro section .qspi_text, ro section .qspi_rodata };

  Address       Size  Type    Object
  0x08000000   0x1204  code    display.o
  0x08001204   0x0936  code    main.o
  0x08001b3a   0x0914  code    motor.o
  0x0800244e   0x0450  code    sensor.o
  0x0800289e   0x030c  code    utils.o
  0x90000000  0x4500  code    wifi.o

***************************************************************************
*** MODULE SUMMARY ***

Module                      ro code    ro data    rw data
------                      -------    -------    -------
command line/config:              4          0          0
---------------------------------------------------------------------------
Total:                            4          0          0

C:\\Projects\\EmbeddedApp\\Debug\\Obj: [1]
  display.o                   4,612     12,864         64
  main.o                      2,358        288         16
  motor.o                     2,320         12          4
  sensor.o                    1,104         48          8
  utils.o                       780         24          0
  wifi.o                     17,664      4,800        256
---------------------------------------------------------------------------
Total:                       28,838     18,036        348

rt7M_tl.a: [2]
  aeabi_readwrite.o              24          0          0
  memcpy.o                       88          0          0
  memset.o                       44          0          0
  rt_toc.o                      120          8          0
---------------------------------------------------------------------------
Total:                          276          8          0

m7M_tls.a: [3]
  addsub.o                      416          0          0
  fpinit.o                       64          0          0
  muldiv.o                      544          0          0
---------------------------------------------------------------------------
Total:                        1,024          0          0

dl7M_tln.a: [4]
  abort.o                         8          0          0
  exit.o                         12          4          0
  xpnd.o                        140          0          0
  yvals.o                         0         44          0
---------------------------------------------------------------------------
Total:                          160         48          0

Linker created:
  initializer bytes               0        348          0
  vtable                          0        128          0
---------------------------------------------------------------------------
Total:                            0        476          0

Grand Total:                 30,302     18,568        348`;

const SAMPLE_EWP_FALLBACK = `<?xml version="1.0" encoding="iso-8859-1"?>
<project>
  <fileVersion>3</fileVersion>
  <configuration>
    <name>Debug</name>
  </configuration>
  <group>
    <name>Application</name>
    <group>
      <name>UI</name>
      <file>
        <name>$PROJ_DIR$\\display.c</name>
      </file>
    </group>
    <file>
      <name>$PROJ_DIR$\\main.c</name>
    </file>
    <file>
      <name>$PROJ_DIR$\\utils.c</name>
    </file>
  </group>
  <group>
    <name>Drivers</name>
    <file>
      <name>$PROJ_DIR$\\motor.c</name>
    </file>
    <file>
      <name>$PROJ_DIR$\\sensor.c</name>
    </file>
  </group>
  <group>
    <name>Connectivity</name>
    <file>
      <name>$PROJ_DIR$\\wifi.c</name>
    </file>
  </group>
</project>`;
