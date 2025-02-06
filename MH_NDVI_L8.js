//Estructurado de: https://developers.google.com/earth-engine/tutorials/community/time-series-modeling

var ZN = ee.FeatureCollection ('projects/ee-mere10eloy/assets/ZN');
var ZS = ee.FeatureCollection ('projects/ee-mere10eloy/assets/ZS');

//=========================Determinando la superficie de cada zona de estudio.====================================/

var ZNarea= ZN.geometry().area().divide(10000);
var ZSarea= ZS.geometry().area().divide(10000);

//======================================Imprimiendo superficies áreas de estudio.===============================/
print ('Superficie ZN ha', ZNarea);
print ('Superficie ZS ha', ZSarea);
//======================================Unión de zonas de estudio.============================================================================/

var zonas = ee.FeatureCollection (ZN.merge(ZS));

// Function to cloud mask from the pixel_qa band of Landsat 8 SR data.
var maskL8sr = function(image) {
  // Bit 0 - Fill
  // Bit 1 - Dilated Cloud
  // Bit 2 - Cirrus
  // Bit 3 - Cloud
  // Bit 4 - Cloud Shadow
  var qaMask = image.select('QA_PIXEL').bitwiseAnd(parseInt('11111', 2)).eq(0);
  var saturationMask = image.select('QA_RADSAT').eq(0);

  // Apply the scaling factors to the appropriate bands.
  var opticalBands = image.select('SR_B.').multiply(0.0000275).add(-0.2);
  var thermalBands = image.select('ST_B.*').multiply(0.00341802).add(149.0);

  // Replace the original bands with the scaled ones and apply the masks.
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
 
// Function to add NDVI, time, and constant variables to Landsat 8 imagery.
var addVariables = function(image) {
  // Compute time in fractional years since the epoch.
  var date = image.date();
  var years = date.difference(ee.Date('1970-01-01'), 'year');
  // Return the image with the added bands.
  return image
  // Add an NDVI band.
  .addBands(image.normalizedDifference(['SR_B5', 'SR_B4']).rename('NDVI'))
  // Add a time band.
  .addBands(ee.Image(years).rename('t')).float()
  // Add a constant band.
  .addBands(ee.Image.constant(1)).clip(zonas);
};
// Remove clouds, add variables and filter to the area of interest.
var filteredLandsat = L8
  .filterBounds(zonas)
  .filterDate('2014-01-01', '2023-12-31')
  .map(maskL8sr)
  .map(addVariables);
  
  // Plot a time series of NDVI at a single location.
Map.centerObject(zonas, 11);
Map.addLayer(filteredLandsat,
  {bands: 'NDVI', min: -0.77, max: 0.98, palette: ['white', 'green']},
  'NDVI Mosaic');
Map.addLayer(zonas, {color: 'yellow'}, 'ROI');

//Puede hacer clic en el botón "exportar" al lado del gráfico para ver un 
//gráfico interactivo. Desplazar sobre algunos de los puntos de datos y 
//observe las relaciones entre los datos. Una línea que conecta dos puntos 
//significa que son puntos de datos secuenciales (obsérvese que hay 
//relativamente pocos puntos secuenciales).
//También podemos ver que hay saltos relativamente grandes en los datos, 
//con un ascenso en algún momento entre marzo y finales de abril, y un 
//descenso a finales de agosto. Cada año es ligeramente diferente, pero 
//podemos suponer que esto se debe a las lluvias estacionales en la primavera y
//a las hojas que mueren en el otoño. Finalmente, la tendencia general es a la 
//baja, aunque el dato de febrero de 2021 podría tener una influencia 
//significativa en la tendencia.

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


// List of the independent variable names.
var independents = ee.List(['constant', 't']);
// Name of the dependent variable.
var dependent = ee.String('NDVI');
// Compute a linear trend. This will have two bands: 'residuals' and
// a 2x1 band called 'coefficients' (columns are for dependent variables).
var trend = filteredLandsat.select(independents.add(dependent))
  .reduce(ee.Reducer.linearRegression(independents.length(), 1));
Map.addLayer(trend, {}, 'Trend Array Image');
// Flatten the coefficients into a 2-band image.
var coefficients = trend.select('coefficients')
  .arrayProject([0])
  .arrayFlatten([independents]);
  Map.addLayer(coefficients,{}, 'coefficients image');
var residual = trend.select('residuals')
    .arrayProject([0]); 
  Map.addLayer(residual,{}, 'residuals image');
  
  
  // Crear una imagen combinada con las 3 bandas
var trendImage = coefficients.addBands(residual);

// Ver la estructura de la imagen combinada
Map.addLayer (trendImage, {}, 'Tendencia');
  
  
//En comparación con el gráfico anterior, los datos se ven similares, 
//pero ahora, la ligera pendiente descendente se tiene en cuenta con nuestro 
//modelo lineal. Cada punto de datos ajustado (punto de datos en el modelo 
//lineal) se resta de cada uno de los puntos de datos observados. Además, el 
//eje Y ahora está centrado en 0 y la escala varía de 0 a +/- 0,45. Esto nos 
//permite centrarnos en los patrones cíclicos de los datos con las tendencias 
//a largo plazo de los datos eliminadas.

// Compute a detrended series ZN.
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
  
// Compute a detrended series ZS.
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
  
//==========Estimate seasonality with a harmonic model
  
//==========Use these independent variables in the harmonic regression.
var harmonicIndependents = ee.List(['constant', 't', 'cos', 'sin']);
//===========Add harmonic terms as new image bands.
var harmonicLandsat = filteredLandsat.map(function(image) {
  var timeRadians = image.select('t').multiply(2 * Math.PI);
    return image
      .addBands(timeRadians.cos().rename('cos'))
      .addBands(timeRadians.sin().rename('sin'));
  });

//Ajuste el modelo con una tendencia lineal, utilizando el reductor linearRegression().
  var harmonicTrend = harmonicLandsat
  .select(harmonicIndependents.add(dependent))
  // The output of this reducer is a 4x1 array image.
  .reduce(ee.Reducer.linearRegression({
   numX: harmonicIndependents.length(),
   numY: 1
  }));
  
//  Conecte los coeficientes en la ecuación 2 para obtener una serie de tiempo de valores ajustados:
  // Turn the array image into a multi-band image of coefficients.
var harmonicTrendCoefficients = harmonicTrend.select('coefficients')
  .arrayProject([0])
  .arrayFlatten([harmonicIndependents]);
// Compute fitted values.
var fittedHarmonic = harmonicLandsat.map(function(image) {
  return image.addBands(
    image.select(harmonicIndependents)
      .multiply(harmonicTrendCoefficients)
      .reduce('sum')
      .rename('fitted'));
});
// Plot the fitted model and the original data at the ROI (ZN).
print(ui.Chart.image.series(fittedHarmonic.select(['fitted', 'NDVI']), ZN,
      ee.Reducer.median(), 30) //.mean()
  .setSeriesNames(['NDVI', 'fitted'])
  .setOptions({
    title: 'Harmonic Model_ZN: Original y valores ajustados',
    lineWidth: 1,
    pointSize: 3
  })
);

// Plot the fitted model and the original data at the ROI (ZS).
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

// Compute phase and amplitude.
var phase = harmonicTrendCoefficients.select('sin')
  .atan2(harmonicTrendCoefficients.select('cos'))
  // Scale to [0, 1] from radians.
  .unitScale(-Math.PI, Math.PI);
var amplitude = harmonicTrendCoefficients.select('sin')
  .hypot(harmonicTrendCoefficients.select('cos'))
  // Add a scale factor for visualization.
  .multiply(5);
  // Compute the mean NDVI.
var medianNdvi = filteredLandsat.select('NDVI').median(); // mean
// Use the HSV to RGB transformation to display phase and amplitude.
var seasonality  = ee.Image.cat([phase, amplitude, medianNdvi]).hsvToRgb();
Map.addLayer(seasonality , {}, 'Seasonality: Phase (hue), Amplitude (sat), NDVI (val)');

//==========================Parametros de visualizacion.

// Map the function over one year of data.
var L8_01 = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
                     .filterDate('2014-01-01', '2023-12-31')
                     .map(maskL8sr).filterBounds(zonas);

var L8_m = L8_01.median();

var visualization = {
  bands: ['SR_B4', 'SR_B3', 'SR_B2'],
  min: 0.0,
  max: 0.3,
};

//====================Agregar capas al mapa.

Map.addLayer (L8_m.clip(zonas), visualization, 'True Color (432)');

//Exportar a drive

Export.image.toDrive(
{image: medianNdvi, // 'B3','B4','B8' .select('SR_B4_median', 'SR_B3_median', 'SR_B2_median')
description: 'NDVI_Mosaico', 
folder: 'GEE',
scale: 10,
region:zonas,
crs: 'EPSG:32616',
maxPixels: 1e13
});

Export.image.toDrive(
{image: coefficients, 
description: 'Arreglo_Tendencia', 
folder: 'GEE',
scale: 10,
region:zonas,
crs: 'EPSG:32616',
maxPixels: 1e13
});

//
Export.image.toDrive(
{image: trendImage, 
description: 'Tendencia', 
folder: 'GEE',
scale: 10,
region:zonas,
crs: 'EPSG:32616',
maxPixels: 1e13
});

//
Export.image.toDrive(
{image: seasonality, 
description: 'Estacionalidad', 
folder: 'GEE',
scale: 10,
region:zonas,
crs: 'EPSG:32616',
maxPixels: 1e13
});
