//===================================================================Sección_01========================================================================/
//Estructurado de GEE: https://developers.google.com/earth-engine/tutorials/community/explore.
//======================================1. Cargar Área de estudio, Zona Norte y Sur de la RBSK.====================================================/

var ZN = ee.FeatureCollection ('projects/ee-mere10eloy/assets/ZN');
var ZS = ee.FeatureCollection ('projects/ee-mere10eloy/assets/ZS');

//===========================================2. Determinando la superficie de cada zona de estudio.====================================/
var ZNarea= ZN.geometry().area().divide(10000);
var ZSarea= ZS.geometry().area().divide(10000);

//============================================3. Imprimiendo superficies áreas de estudio.=======================================/
print ('Superficie ZN ha', ZNarea);
print ('Superficie ZS ha', ZSarea);
//============================================4. Unión de zonas de estudio.===========================================================/
var zonas = ee.FeatureCollection (ZN.merge(ZS));

//============================================5. QBanda QA_PIXEL (CFMask) para enmascarar píxeles no deseados.========================/

function maskL8sr(image) {
  // Bit 0 - Fill
  // Bit 1 - Dilated Cloud
  // Bit 2 - Cirrus
  // Bit 3 - Cloud
  // Bit 4 - Cloud Shadow
  var qaMask = image.select('QA_PIXEL').bitwiseAnd(parseInt('11111', 2)).eq(0);
  //var saturationMask = image.select('QA_RADSAT').eq(0);

  //==========================================6. Aplique los factores de escala a las bandas apropiadas.==================================/
  var opticalBands = image.select('SR_B.').multiply(0.0000275).add(-0.2);
  //var thermalBands = image.select('ST_B.*').multiply(0.00341802).add(149.0);

  //=======================================7. Reemplaza las bandas originales con las escaladas y aplica las máscaras..====================/
  return image.addBands(opticalBands, null, true)
     // .addBands(thermalBands, null, true)
      .updateMask(qaMask);
      //.updateMask(saturationMask);
}

//=======================================8. Filtrado de fechas de estudio en la colección L8===============================================/
//==========================================================2014==========================================================/
var L8_01 = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
    .filterDate('2014-01-01', '2014-12-31') //Estableciendo fechas de estudio
    //.filterMetadata ('CLOUD_COVER', 'Less_Than', 20)
      //.sort('CLOUD_COVER') //ordena la colección de imágenes de forma ascendente, 
                           // de acuerdo al valor de la característica indicada
      .filterBounds(zonas)
      .map(maskL8sr)
      ;
   print (L8_01);
 
//==========================================================2023========================================================/  
  var L8_02 = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
    .filterDate('2023-01-01', '2023-12-31') //Estableciendo fechas de estudio
    //.filterMetadata ('CLOUD_COVER', 'Less_Than', 20)
      //.sort('CLOUD_COVER') //ordena la colección de imágenes de forma ascendente, 
                           // de acuerdo al valor de la característica indicada
      .filterBounds(zonas)
      .map(maskL8sr)
      ;
   print (L8_02);

//=========================================================9. Estimar el número de escenas.============================/
var n_01= L8_01.size(); 
print(n_01);

var n_02=L8_02.size();
print(n_02);
/*
//=========================================================Bandas Landsat 8 (Resolución espacial).===================/
1: Coastal aerosol (30m)
2: Blue (30m)
3: Green (30m)
4: Red (30m)
5: NIR (30m)
6: SWIR 1 (30m)
7: SWIR 2 (30m)
8: Pancromático (15m)
9:  Cirrus  (30m)
10: TIRS 1 (100m)
11: TIRS 2 (100m)
*/
//====================================NDVI (Normalized Difference Vegetation Index).=======================================/
//====================================NDVI = (Banda 5 – Banda 4)/(Banda 5 + Banda 4).=====================================/

//================================================10. Función para calcular NDVI.=========================================/

var addNDVI = function (image) {
   var ndvi_img = image.normalizedDifference(['SR_B5', 'SR_B4'])
                      .rename('NDVI'); 
                     
   return image.addBands(ndvi_img); //Función para generar calculo de ndvi y regresar imagen con estimación
   }
;

//==================================================11. Calcular NDVI para catalogo L8.====================================/

var ndvi_01 = L8_01.map(addNDVI).select('NDVI').median().clip(zonas);
var ndvi_02 = L8_02.map(addNDVI).select('NDVI').median().clip(zonas);

 //5.==============================12. Estableciendo umbrales derivado de NDVI==============================================/        
 //=================================================Umbrales 2014.=======================================================/
 var NDVI_C1 =ndvi_01
          .where(ndvi_01 .gt(-0.77).and(ndvi_01.lte (0)),  1) // Suelo desnudo y/o Agua;
          .where(ndvi_01 .gt(0).and(ndvi_01.lte (0.25)),  2) //Vegetación de baja densidad; 
          .where(ndvi_01 .gt(0.25).and(ndvi_01.lte(0.35)), 3)// Vegetación de densidad media baja;
          .where(ndvi_01 .gt(0.35).and(ndvi_01 .lte(0.65)), 4)// Vegetación de densidad media alta; y
          .where(ndvi_01 .gt(0.65).and(ndvi_01.lte(0.97)),5); // Vegetación de alta densidad.        
          
//=====================================================Umbrales 2023.====================================================/
var NDVI_C2 = ndvi_02 
          .where(ndvi_02 .gt(-0.77).and(ndvi_02.lte (0)),  1) // Suelo desnudo y/o Agua;
          .where(ndvi_02 .gt(0).and(ndvi_02.lte (0.25)),  2) // Vegetación de baja densidad; 
          .where(ndvi_02.gt(0.25).and(ndvi_02.lte(0.35)), 3)// Vegetación de densidad media baja;
          .where(ndvi_02.gt(0.35).and(ndvi_02.lte(0.65)), 4)// Vegetación de densidad media alta; y
          .where(ndvi_02.gt(0.65).and(ndvi_02.lte(0.97)),5); //Vegetación de alta densidad

//==================================================13.Estadisticos descriptivos para NDVI.===============================================/

var reducer1 = ee.Reducer.mean(); //variables y funciones para obtener estadisticos descriptivos.
var reducers = reducer1.combine({reducer2: ee.Reducer.median(), sharedInputs: true})
                       .combine({reducer2: ee.Reducer.stdDev(), sharedInputs: true})
                       .combine({reducer2: ee.Reducer.variance(), sharedInputs: true})
                       .combine({reducer2: ee.Reducer.max(), sharedInputs: true})
                       .combine({reducer2: ee.Reducer.min(), sharedInputs: true});                         
              
//=====================================================2014===============================================/
//==================================================1. ZN.==============================================/

var results_01 =ndvi_01.select('NDVI').reduceRegion({reducer: reducers,
                                geometry: ZN,
                                scale: 30,
                                bestEffort: true}); 

print ('Estadisticos_NDVI_ZN_2014', results_01);

//===================================================2. ZS.===========================================/
var results_02 =ndvi_01.select('NDVI').reduceRegion({reducer: reducers,
                                geometry: ZS,
                                scale: 30,
                                bestEffort: true}); 

print ('Estadisticos_NDVI_ZS_2014', results_02);

//=======================================================2023===========================================/
//=====================================================1. ZN.==========================================/

var results_03 =ndvi_02.select('NDVI').reduceRegion({reducer: reducers,
                                geometry: ZN,
                                scale: 30,
                                bestEffort: true}); 

print ('Estadisticos_NDVI_ZN_2023', results_03);

//===================================================2. ZS.===========================================/
var results_04 =ndvi_02.select('NDVI').reduceRegion({reducer: reducers,
                                geometry: ZS,
                                scale: 30,
                                bestEffort: true}); 

print ('Estadisticos_NDVI_ZS_2023', results_04);

//=================================================14. Parametros de visualizacion.====================/

var visualization_01 = {
  bands: ['SR_B4', 'SR_B3', 'SR_B2'],
  min: 0.0,
  max: 0.3,
};
var visualization_02 = {
  bands: ['SR_B4', 'SR_B3', 'SR_B2'],
  min: 0.0,
  max: 0.3,
};
//====================================================15. Agregar capas al mapa.==========================/

Map.addLayer (L8_01.median().clip(zonas), visualization_01, 'True Color (432)');
Map.addLayer (L8_02.median().clip(zonas), visualization_02, 'True Color (432)');
Map.addLayer (ndvi_01, {min:-1,max:1}, 'NDVI_2014');
Map.addLayer (ndvi_01, imageVisParam,'NDVI_02');
//Map.addLayer (ndvi, imageVisParam3,'NDVI_03');
Map.addLayer(ndvi_02, {min:-1, max: 1}, 'NDVI_2023');

//==========================================16. Centrar mapa al area de estudio.=============================/

//Map.setCenter(-87.1030, 20.6017); Para Coordenada
Map.centerObject (zonas);

//==============================================17. Exportar capas a drive.=================================/

//================================================2014===================================/
Export.image.toDrive({
image:NDVI_C1, 
description: 'NDVI_2014', 
folder: 'GEE', 
region: zonas, 
scale: 30, 
crs: 'EPSG:32616', 
maxPixels: 1e13});

//================================================2023================================/
Export.image.toDrive({
image:NDVI_C2, 
description: 'NDVI_2023', 
folder: 'GEE', 
region: zonas, 
scale: 30, 
crs: 'EPSG:32616', 
maxPixels: 1e13});

//==================================18. Histograma sobre los valores de NDVI_2014.==================================/
//======================================1. Formato de visualización del histograma ZN.=================================/

var opciones = {
  //Título
  title: 'Histograma de Valores NDVI-ZN_2014',
  // tamaño de letra
  fontSize: 15,
  //Título del eje horizontal
  hAxis: {title: 'Distribución Valores NDVI'},
  //Título del eje vertical
  vAxis: {title: 'Frecuencia'},
   minBucketWidth:(-0.5,1, 0.05),
  // Colores de las series
  series: {
    0: {color: '#45fdff'},
    }};
 
//=====================================Definiendo datos del histograma (imagen, región, resolución espacial en metros).==========/

var histogram_01 = ui.Chart.image.histogram(ndvi_01, ZN, 30)
    // Definir nombres de las series
    .setSeriesNames(['NDVI'])
    // Agregar las opciones de histograma definidas previamente
    .setOptions(opciones);
   
 //Mostrar histograma en la consola.
print(histogram_01);

//==============================================2. Formato de visualización del histograma ZS.===============================/
var opciones = {
  //Título
  title: 'Histograma de Valores NDVI-ZS_2014',
  // tamaño de letra
  fontSize: 15,
  //Título del eje horizontal
  hAxis: {title: 'Distribución Valores NDVI'},
  //Título del eje vertical
  vAxis: {title: 'Frecuencia'},
   minBucketWidth:(-0.5,1, 0.05),
  // Colores de las series
  series: {
    0: {color: '#45fdff'},
    }};
 
//======================================Definiendo datos del histograma (imagen, región, resolución espacial en metros).============/

var histogram_02 = ui.Chart.image.histogram(ndvi_01, ZS, 30)
    // Definir nombres de las series
    .setSeriesNames(['NDVI'])
    // Agregar las opciones de histograma definidas previamente
    .setOptions(opciones);
   
 //Mostrar histograma en la consola.
print(histogram_02);

//================================================19. Histograma sobre los valores de NDVI_2023.====================================/

//===============================================1. Formato de visualización del histograma ZN.====================================/

var opciones = {
  //Título
  title: 'Histograma de Valores NDVI-ZN_2023',
  // tamaño de letra
  fontSize: 15,
  //Título del eje horizontal
  hAxis: {title: 'Distribución Valores NDVI'},
  //Título del eje vertical
  vAxis: {title: 'Frecuencia'},
   minBucketWidth:(-0.5,1, 0.05),
  // Colores de las series
  series: {
    0: {color: '#45fdff'},
    }};
 
//================================Definiendo datos del histograma (imagen, región, resolución espacial en metros).===========================/

var histogram_01 = ui.Chart.image.histogram(ndvi_02, ZN, 30)
    // Definir nombres de las series
    .setSeriesNames(['NDVI'])
    // Agregar las opciones de histograma definidas previamente
    .setOptions(opciones);
   
 //Mostrar histograma en la consola.
print(histogram_01);

//==========================================2. Formato de visualización del histograma ZS.==================================================/
var opciones = {
  //Título
  title: 'Histograma de Valores NDVI-ZS_2023',
  // tamaño de letra
  fontSize: 15,
  //Título del eje horizontal
  hAxis: {title: 'Distribución Valores NDVI'},
  //Título del eje vertical
  vAxis: {title: 'Frecuencia'},
   minBucketWidth:(-0.5,1, 0.05),
  // Colores de las series
  series: {
    0: {color: '#45fdff'},
    }};
 
//=================================Definiendo datos del histograma (imagen, región, resolución espacial en metros).============================/

var histogram_02 = ui.Chart.image.histogram(ndvi_02, ZS, 30)
    // Definir nombres de las series
    .setSeriesNames(['NDVI'])
    // Agregar las opciones de histograma definidas previamente
    .setOptions(opciones);
   
 //Mostrar histograma en la consola.
print(histogram_02);

//*******************************************************************************************************************************************************/
//******************************************************************************************************************************************************/
//==========================================================Sección_02.===========================================================================/

//Estructurado de: https://developers.google.com/earth-engine/tutorials/community/time-series-modeling
//============================1. Zonas de estudio en la Reserva de la Biosfera de Sian Ka´an.======================/
var ZN = ee.FeatureCollection ('projects/ee-mere10eloy/assets/ZN');
var ZS = ee.FeatureCollection ('projects/ee-mere10eloy/assets/ZS');

//=========================2. Determinando la superficie de cada zona de estudio.====================================/

var ZNarea= ZN.geometry().area().divide(10000);
var ZSarea= ZS.geometry().area().divide(10000);

//======================================3. Imprimiendo superficies áreas de estudio.===============================/
print ('Superficie ZN ha', ZNarea);
print ('Superficie ZS ha', ZSarea);

//======================================4. Unión de zonas de estudio.=================================================/

var zonas = ee.FeatureCollection (ZN.merge(ZS));

//======================================5. Función para enmascarar la nube de la banda pixel_qa de datos Landsat 8 SR.====/
var maskL8sr = function(image) {
  // Bit 0 - Fill
  // Bit 1 - Dilated Cloud
  // Bit 2 - Cirrus
  // Bit 3 - Cloud
  // Bit 4 - Cloud Shadow
  var qaMask = image.select('QA_PIXEL').bitwiseAnd(parseInt('11111', 2)).eq(0);
  var saturationMask = image.select('QA_RADSAT').eq(0);

  //======================================6. Aplicar los factores de escala a las bandas.================================/
  var opticalBands = image.select('SR_B.').multiply(0.0000275).add(-0.2);
  var thermalBands = image.select('ST_B.*').multiply(0.00341802).add(149.0);

  //========================================7. Reemplazar las bandas originales con las escalas y aplicar la mascara.=========/
  return image.addBands(opticalBands, null, true)
    .addBands(thermalBands, null, true)
    .updateMask(qaMask)
    .updateMask(saturationMask);
};

var L8 = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2');
   // .filterDate('2014-01-01', '2023-12-31') //Estableciendo fechas de estudio
    //.filterMetadata ('CLOUD_COVER', 'Less_Than', 20)
      //.sort('CLOUD_COVER') //ordena la colección de imágenes de forma ascendente, 
                           // de acuerdo al valor de la característica indicada
      //.filterBounds(zonas)
      //.map(maskL8sr)
     //print (L8);
 //====================================8. Función para agregar NDVI, tiempo y variables constantes a las imágenes L8.=====/

var addVariables = function(image) {
  // Calcular el tiempo en fracciones de años desde la época.
  var date = image.date();
  var years = date.difference(ee.Date('1970-01-01'), 'year');
  // Devuelve la imagen con las bandas agregadas.
  return image
  // Agregar banda NDVI.
  .addBands(image.normalizedDifference(['SR_B5', 'SR_B4']).rename('NDVI'))
  // Agregar banda de tiempo.
  .addBands(ee.Image(years).rename('t')).float()
  // Agregar banda de constante
  .addBands(ee.Image.constant(1)).clip(zonas);
};

//=========================================9. Remover nubes, agregar variables y filtrar al área de interes.==========/

var filteredLandsat = L8
  .filterBounds(zonas)
  .filterDate('2014-01-01', '2023-12-31')
  .map(maskL8sr)
  .map(addVariables);
  
  // =============================================10. Trazar una serie temporal de NDVI en la ubicación de estudio.=========/

Map.centerObject(zonas, 11);
Map.addLayer(filteredLandsat,
  {bands: 'NDVI', min: -0.77, max: 0.98, palette: ['white', 'green']},
  'NDVI Mosaic');
Map.addLayer(zonas, {color: 'yellow'}, 'ROI');

//Se puede hacer clic en el botón "exportar" al lado del gráfico para ver un 
//gráfico interactivo. Desplazar sobre algunos de los puntos de datos y 
//observe las relaciones entre los datos. Una línea que conecta dos puntos 
//significa que son puntos de datos secuenciales.
//Se puede observar que hay saltos entre los datos entre el periodo evaluado 
//con ascensos y descensos entre los meses. Cada año es ligeramente diferente, derivado de las temporadas 
//existentes en el área de estudio (secas, lluvias y nortes).

var l8Chart_01= ui.Chart.image.series(filteredLandsat.select('NDVI'), ZN)
  .setChartType('ScatterChart')
  .setOptions({
   title: 'NDVI_Serie de Tiempo_ZN',
   trendlines: {
     0: {color: 'CC0000'}
   },
   lineWidth: 1,
   pointSize: 3,
  });
print(l8Chart_01);

//==============================11. Generar gráfico de serie de tiempo.================================/

var l8Chart_02= ui.Chart.image.series(filteredLandsat.select('NDVI'), ZS)
  .setChartType('ScatterChart')
  .setOptions({
   title: 'NDVI_Serie de Tiempo_ZS',
   trendlines: {
     0: {color: 'CC0000'}
   },
   lineWidth: 1,
   pointSize: 3,
  });
print(l8Chart_02);

// Lista de los nombres de las variables independientes.
var independents = ee.List(['constant', 't']);
// Nombre de la variable dependiente.
var dependent = ee.String('NDVI');
// Calcule una tendencia lineal. Éste tendrá dos bandas: 'residuales' y
// una banda de 2x1 llamada 'coeficientes' (las columnas son para variables dependientes).
var trend = filteredLandsat.select(independents.add(dependent))
  .reduce(ee.Reducer.linearRegression(independents.length(), 1));
Map.addLayer(trend, {}, 'Trend Array Image');
// Aplana los coeficientes en una imagen de 2 bandas y agrega a la pantalla de rutinas.
var coefficients = trend.select('coefficients')
  .arrayProject([0])
  .arrayFlatten([independents]);
  Map.addLayer(coefficients,{}, 'coefficients image');
var residual = trend.select('residuals')
    .arrayProject([0]); 
  Map.addLayer(residual,{}, 'residuals image');
  
//===============================================12.Crear una imagen combinada con las 3 bandas.=====================/
var trendImage = coefficients.addBands(residual);

//================================================13. Ver la estructura de la imagen combinada.======================/
Map.addLayer (trendImage, {}, 'Tendencia');
  
  
//En comparación con el gráfico anterior, los datos se ven similares, 
//pero ahora, la ligera pendiente descendente se tiene en cuenta con nuestro 
//modelo lineal. Cada punto de datos ajustado (punto de datos en el modelo 
//lineal) se resta de cada uno de los puntos de datos observados. Además, el 
//eje Y ahora está centrado en 0 y la escala varía de 0 a +/- 0,45. Esto nos 
//permite centrarnos en los patrones cíclicos de los datos con las tendencias 
//a largo plazo de los datos eliminadas.

//============================================14. Calcule una serie sin tendencia ZN.=========================/
var detrended = filteredLandsat.map(function(image) {
  return image.select(dependent).subtract(
    image.select(independents).multiply(coefficients).reduce('sum'))
    .rename(dependent)
    .copyProperties(image, ['system:time_start']);
});

var detrendedChart = ui.Chart.image.series(detrended, ZN, null, 30)
  .setOptions({
    title: 'Detrended Landsat Time Series at ZN',
    lineWidth: 1,
    pointSize: 3,
  });
print(detrendedChart);
  
//===================================================15. Calcule una serie ZS sin tendencia.============================/
var detrended = filteredLandsat.map(function(image) {
  return image.select(dependent).subtract(
    image.select(independents).multiply(coefficients).reduce('sum'))
    .rename(dependent)
    .copyProperties(image, ['system:time_start']);
});

var detrendedChart = ui.Chart.image.series(detrended, ZS, null, 30)
  .setOptions({
    title: 'Detrended Landsat Time Series at ZS',
    lineWidth: 1,
    pointSize: 3,
  });
print(detrendedChart); 
  
//===========================16. Estimar la estacionalidad con un modelo armónico de Fourier.=============================/

  
//=========================Utilice las variables independientes en la regresión armónica.===========================/
var harmonicIndependents = ee.List(['constant', 't', 'cos', 'sin']);
//===========================Agregue términos armónicos como nuevas bandas de imágenes.==============================/
var harmonicLandsat = filteredLandsat.map(function(image) {
  var timeRadians = image.select('t').multiply(2 * Math.PI);
    return image
      .addBands(timeRadians.cos().rename('cos'))
      .addBands(timeRadians.sin().rename('sin'));
  });

//=======================================17. Ajuste el modelo con una tendencia lineal, utilizando el reductor linearRegression======/
  var harmonicTrend = harmonicLandsat
  .select(harmonicIndependents.add(dependent))
  //====================================la salida de este reductor es una imagen de matriz 4x1.==================================/
  .reduce(ee.Reducer.linearRegression({
   numX: harmonicIndependents.length(),
   numY: 1
  }));
  
//=============================================18. Conecte los coeficientes en la ecuación 2 para obtener una serie de tiempo de valores ajustados:===/
//=====================================Convierta la imagen de matriz en una imagen de coeficientes multibanda.==========================================/
var harmonicTrendCoefficients = harmonicTrend.select('coefficients')
  .arrayProject([0])
  .arrayFlatten([harmonicIndependents]);
//=========================================Calcule los valores ajustados.======================================================/

var fittedHarmonic = harmonicLandsat.map(function(image) {
  return image.addBands(
    image.select(harmonicIndependents)
      .multiply(harmonicTrendCoefficients)
      .reduce('sum')
      .rename('fitted'));
});
//======================================================19. Gráfico del modelo ajustado y los datos originales en el ROI (ZN).========/

print(ui.Chart.image.series(fittedHarmonic.select(['fitted', 'NDVI']), ZN,
      ee.Reducer.median(), 30) //.mean()
  .setSeriesNames(['NDVI', 'fitted'])
  .setOptions({
    title: 'Harmonic Model_ZN: Original y valores ajustados',
    lineWidth: 1,
    pointSize: 3
  })
);

//=========================================20. Gráfico del modelo ajustado y los datos originales en el ROI (ZS).========================/
print(ui.Chart.image.series(fittedHarmonic.select(['fitted', 'NDVI']), ZS,
      ee.Reducer.median(), 30) //.mean()
  .setSeriesNames(['NDVI', 'fitted'])
  .setOptions({
    title: 'Harmonic Model_ZS: Original y valores ajustados',
    lineWidth: 1,
    pointSize: 3
  })
);

//Aunque cualquier coeficiente se puede mapear directamente, a menudo es útil 
//e interesante mapear la fase y la amplitud del modelo armónico estimado. 
//Primero, se calcula la fase y la amplitud a partir de los coeficientes, luego 
//se incorpora esta información en cada píxel. Se usa el inspector para mirar los 
//píxeles y se observa su fase y amplitud.

//==========================================================21. Calcular fase y amplitud.====================================================/
var phase = harmonicTrendCoefficients.select('sin')
  .atan2(harmonicTrendCoefficients.select('cos'))
  //================================================22. Escala a [0, 1] desde radianes.======================================/
  .unitScale(-Math.PI, Math.PI);
var amplitude = harmonicTrendCoefficients.select('sin')
  .hypot(harmonicTrendCoefficients.select('cos'))
  //==============================================23. Agregue un factor de escala para la visualización.==========================/
  .multiply(5);
  //===============================================24. Calcule la mediana de NDVI.===================================================/
var medianNdvi = filteredLandsat.select('NDVI').median(); // mean
// ===================================25. Utilizar la transformación HSV a RGB para mostrar la fase y la amplitud.=================/
var seasonality  = ee.Image.cat([phase, amplitude, medianNdvi]).hsvToRgb();
Map.addLayer(seasonality , {}, 'Seasonality: Phase (hue), Amplitude (sat), NDVI (val)');

//==============================================26. Parametros de visualizacion.=================================================/

//================================================Mapee la función a lo largo de un año de datos.=================================/
var L8_01 = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
                     .filterDate('2014-01-01', '2023-12-31')
                     .map(maskL8sr).filterBounds(zonas);

var L8_m = L8_01.median();

var visualization = {
  bands: ['SR_B4', 'SR_B3', 'SR_B2'],
  min: 0.0,
  max: 0.3,
};

//=====================================================27. Agregar capas al mapa.=====================================================/

Map.addLayer (L8_m.clip(zonas), visualization, 'True Color (432)');

//======================================================28. Exportar a drive.=======================================================/
//===============================01.
Export.image.toDrive(
{image: medianNdvi, // 'B3','B4','B8' .select('SR_B4_median', 'SR_B3_median', 'SR_B2_median')
description: 'NDVI_Mosaico', 
folder: 'GEE',
scale: 10,
region:zonas,
crs: 'EPSG:32616',
maxPixels: 1e13
});

//================================02
Export.image.toDrive(
{image: coefficients, 
description: 'Arreglo_Tendencia', 
folder: 'GEE',
scale: 10,
region:zonas,
crs: 'EPSG:32616',
maxPixels: 1e13
});

//===================================03
Export.image.toDrive(
{image: trendImage, 
description: 'Tendencia', 
folder: 'GEE',
scale: 10,
region:zonas,
crs: 'EPSG:32616',
maxPixels: 1e13
});

//======================================04
Export.image.toDrive(
{image: seasonality, 
description: 'Estacionalidad', 
folder: 'GEE',
scale: 10,
region:zonas,
crs: 'EPSG:32616',
maxPixels: 1e13
});
