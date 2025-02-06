# Modelo_Armonico_NDVI_GEE
Estimación de la estacionalidad de la cobertura vegetal mediante NDVI con el modelo armónico de Fourier tomado y ajustado de GEE.
# Desarrollo de código y obtención de información para su posterior análisis.

## Descripción 📋
El presente código esta estructurado y desarrollado para estimar la estacionaldiad de la cobertura vegetal mediante el índice de vegetación de diferencia normalizada (NDVI), aplicado al catalago Landsat 8 (L8) dentro de la plataforma Google Earth Engine para la region central del Caribe Mexicano, donde se ubica la Reserva de la Bisofera de Sian Ka´an (RBSK), Quintana Roo, México. Los cambios estacionales (fenológicos) de la cobertura vegetal en cada pixel de las imágenes apiladas, a través del tiempo, esta estimada para un periodo de 10 años (2014-2023). Información que puede ser descargada para su manejo externo. [**GEE**](https://developers.google.com/earth-engine/guides/getstarted?hl=en).

El repostirorio se elaboró de acuerdo a los lineamientos de la [**licencia GNU General Public License v3.0.**](https://choosealicense.com/licenses/gpl-3.0/).

##Visualización de la Reserva de la Bisofera de Sian Ka´an (RBSK), a tráves de la colección L8, con composición estacional de las bandas de  fase, amplitud, y valor de NDVImediana  en GEE.

![alt text](https://github.com/demostenesmx/NDVI-SAVI_DCA/blob/main/C02_B_3_2_1_RBSK.JPG);  ![alt text](https://github.com/demostenesmx/NDVI-SAVI_DCA/blob/main/Veg%20(B_4-3-2).jpeg) 📖

Estimaciones.

Con la ejecución de este código se obtendrán series de tiempo con valores mensuales por año durante un periodo de 10 años (2011-2020), para la zona norte y sur de la RBSK, con ambos índices multiespectrales de vegetación NDVI y SAVI.

Resultados de la distribución de valores por mes por año para el periodo 2011-2020:

1. ![alt text](https://github.com/demostenesmx/NDVI-SAVI_DCA/blob/main/NDVI-ZN_01.png)

2. ![alt text](https://github.com/demostenesmx/NDVI-SAVI_DCA/blob/main/NDVI-ZS.png)

3. ![alt text](https://github.com/demostenesmx/NDVI-SAVI_DCA/blob/main/SAVI-ZN.png)

4. ![alt text](https://github.com/demostenesmx/NDVI-SAVI_DCA/blob/main/SAVI-ZS.png)

### Capas raster a exportar. 
Las capas raster de exportación se ubicaran dentro de la pestaña Tasks, para su descarga en google drive y posteriormente ser descargadas a la PC personal para su manipulación. Este código fue elaborado mendiante la plataforma GEE. Se puede acceder a través del siguiente link: https://code.earthengine.google.com/?accept_repo=users/veronica78mere/DCA_Tesis

![alt text](https://github.com/demostenesmx/NDVI-SAVI_DCA/blob/main/Raster_Exportación.JPG)

La manipulación de la información contenida en los rasaters puede realizarse, a traves, del sistema de información geografica de su preferencia. Para el presente caso de estudio se utilizó el software de acceso libre QGIS.

![alt text](https://github.com/demostenesmx/NDVI-SAVI_DCA/blob/main/QGis.JPG)
