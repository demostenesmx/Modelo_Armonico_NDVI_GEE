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
