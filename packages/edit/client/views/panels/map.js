
Template.panelPlaceEdit_edit_map.onRendered(function() {
	
	var self = this,
		place = this.data,
		editMap$ = self.$('#editMap'),
		editSave$ = self.$('.btn-editsave'),
		sets = K.settings.public.map;
	
	editMap$
	.on('hidden.bs.collapse', function(e) {
		if(self.editMap) {
			self.editMap.remove();
			delete self.editMap;
			delete self.newloc;
		}
	})
	.on('shown.bs.collapse', function(e) {
		if(!self.editMap) {

			var layerName = K.Profile.getOpts('map.layer') || K.settings.public.map.layer,
				layer = L.tileLayer(sets.layers[layerName], {
					maxZoom: 20,
    				maxNativeZoom: 18
				});

			var icon = new L.NodeIcon(),
				marker = L.marker(place.loc, {icon: icon});

			self.editMap = L.map($(e.target).find('.map')[0], {
				attributionControl:false,
				scrollWheelZoom:false,
				doubleClickZoom:false,
				zoomControl:false,
				layers: layer,
				center: place.loc,
				zoom: 16
			})
			.on('move zoomstart', function(e) {

				var loc = self.editMap.getCenter(),
					newloc = K.Util.geo.locRound([loc.lat, loc.lng]);

				if(!self.geomEditing) {
					marker.setLatLng(newloc);

					self.$('.input-editloc').val(newloc.join(','))
				}
			})
			.addControl(L.control.zoom({
				position: 'bottomright',
				zoomOutText: i18n('map_zoomout'),
				zoomInText: i18n('map_zoomin'),
			}))
			.addControl(L.control.fullscreen({
				position: 'bottomright'
			}))
			.on('fullscreenchange', function(e) {
				
				if(this.isFullscreen())
					this.scrollWheelZoom.enable()
				else
					this.scrollWheelZoom.disable()
			});

			marker.addTo(self.editMap);
			
			Blaze.renderWithData(Template.markerPlace, self, icon.nodeHtml);

			
			if(sets.controls.draw.enabled) {

				let conf = sets.controls.draw;

				_.each(sets.controls.draw, function(c, k) {
					if(c)
						c.shapeOptions = sets.styles.geometry;
				});

				conf.position = 'topright';
				
				if(place.geom) {

					conf.edit.featureGroup = L.geoJson(place.geometry, {
						style: function (f) {
							return f.style || sets.styles.geometry;
						}
					});
				
					let ll = L.latLng(place.loc),
						bb = place.geom.getBounds().extend(ll),
						z = self.editMap.getBoundsZoom(bb);
					self.editMap.setZoom(z-1);
				}
				else
					conf.edit.featureGroup = L.geoJson();

				conf.edit.featureGroup.addTo(self.editMap);
				
				if(place.geometry && place.geometry.type.startsWith('Multi')) {
					editMap$.before(
						'<div class="alert alert-warning">'+
						i18n('error_edit_notMultigeom')+'<div>');
					return;
				}

				self.drawControl = new L.Control.Draw(conf);
				self.drawControl.addTo(self.editMap);
				self.editMap
				.on('draw:editstart', function(e) {
					self.geomEditing = true;
				})
				.on('draw:editstop', function(e) {
					self.geomEditing = false;
				})
				.on('draw:drawstart', function(e) {
					conf.edit.featureGroup.clearLayers();
				})
				.on('draw:created', function (e) {
					var type = e.layerType,
						layer = e.layer,
						geoj = layer.toGeoJSON();

					conf.edit.featureGroup.addData(geoj);
					place.setGeometry(geoj.geometry);
					place.geomEdited = true;
				})
				.on('draw:edited', function (e) {
					var type = e.layerType,
						layer = e.layers,
						geoj = layer.toGeoJSON(),
						feature = geoj.features.pop();

					if(feature) {
						conf.edit.featureGroup.clearLayers();
						conf.edit.featureGroup.addData(feature);
						place.setGeometry(feature.geometry);
					}
					place.geomEdited = true;

					editSave$.trigger('click');
				});			
			}
		}
	});
});


Template.panelPlaceEdit_edit_map.events({
	/* //TODO	'keyup .input-editloc': _.debounce(function(e, tmpl) {
		e.preventDefault();
	}, 300),*/
	'click .btn-editsave': function(e,tmpl) {
		
		var place = tmpl.data,
			newData = {
				loc: K.Util.geo.locRound( tmpl.$('.input-editloc').val().split(',') )
			};
		
		if(place.geomEdited) {
			newData.geometry = place.geometry;
		}

		Meteor.call('updatePlace', place.id, newData, function(err) {
			
			tmpl.$('.collapse').collapse('hide');

			place.update();
			
			if(place.geomEdited) {
				place.geomEdited = false;
				place.showGeometry();
			}
		});
	},
	'click .btn-editcanc': function(e,tmpl) {
		tmpl.$('.collapse').trigger('hidden.bs.collapse');
		tmpl.$('.collapse').trigger('shown.bs.collapse');
		tmpl.$('.input-editloc').val( K.Util.geo.locRound(tmpl.data.loc) )
		//TODO decide beahvior tmpl.$('.collapse').collapse('hide');
	},
});